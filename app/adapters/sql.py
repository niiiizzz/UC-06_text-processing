import os
import sqlite3
import datetime
from typing import Optional, Dict, Any, List
from app.config import settings

_CLIENT_INSTANCE: Optional["SqlClient"] = None


class SqlClient:
    def __init__(self):
        self.auth_mode = settings.SQL_AUTH_MODE
        self._sqlite_mem_conn = None
        if self.auth_mode == "sqlite":
            self.db_path = settings.SQLITE_PATH
            if self.db_path == ":memory:":
                self._sqlite_mem_conn = sqlite3.connect(":memory:")
                self._sqlite_mem_conn.row_factory = sqlite3.Row
            self._init_sqlite()
        else:
            self.server = settings.SQL_SERVER
            self.database = settings.SQL_DATABASE
            self.user = settings.SQL_USER
            self.password = settings.SQL_PASSWORD
            self.driver = settings.SQL_DRIVER

    def _get_connection(self):
        if self.auth_mode == "sqlite":
            if self._sqlite_mem_conn is not None:
                return self._sqlite_mem_conn
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            return conn
        else:
            import pyodbc
            if self.auth_mode == "msi":
                from azure.identity import DefaultAzureCredential
                import struct
                conn_str = f"DRIVER={{{self.driver}}};SERVER={self.server};DATABASE={self.database}"
                credential = DefaultAzureCredential()
                token = credential.get_token("https://database.windows.net/.default")
                token_bytes = token.token.encode("utf-16-le")
                token_struct = struct.pack(f"=i{len(token_bytes)}s", len(token_bytes), token_bytes)
                SQL_COPT_SS_ACCESS_TOKEN = 1256
                return pyodbc.connect(conn_str, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_struct})
            else:
                conn_str = (
                    f"DRIVER={{{self.driver}}};SERVER={self.server};DATABASE={self.database};"
                    f"UID={self.user};PWD={self.password};TrustServerCertificate=yes;"
                )
                return pyodbc.connect(conn_str)

    def _init_sqlite(self):
        conn = self._get_connection()
        cur = conn.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS Tenants (
            tenant_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            plan TEXT NOT NULL,
            subscription_status TEXT NOT NULL,
            period_end TEXT
        );
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS Users (
            user_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL REFERENCES Tenants(tenant_id),
            email TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        );
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS Runs (
            run_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            idempotency_key TEXT NOT NULL,
            input_fingerprint TEXT NOT NULL,
            operation TEXT NOT NULL,
            status TEXT NOT NULL,
            submitted_by TEXT NOT NULL,
            row_count INTEGER NOT NULL,
            valid_rows INTEGER,
            invalid_rows INTEGER,
            result_blob_path TEXT,
            error_code TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL,
            finished_at TEXT,
            UNIQUE(tenant_id, idempotency_key)
        );
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS DailyUsage (
            tenant_id TEXT NOT NULL,
            usage_date TEXT NOT NULL,
            used_count INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (tenant_id, usage_date)
        );
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS Pledges (
            pledge_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            created_by TEXT NOT NULL,
            target_plan TEXT NOT NULL,
            amount_minor INTEGER NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            status TEXT NOT NULL,
            receipt_no TEXT,
            receipt_sig TEXT,
            created_at TEXT NOT NULL,
            settled_at TEXT,
            expires_at TEXT NOT NULL
        );
        """)
        conn.commit()
        if self._sqlite_mem_conn is None:
            conn.close()

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            query = "SELECT user_id, tenant_id, email, display_name, role, password_hash, is_active FROM dbo.Users WHERE email = ?" if self.auth_mode != "sqlite" else "SELECT user_id, tenant_id, email, display_name, role, password_hash, is_active FROM Users WHERE email = ?"
            cur.execute(query, (email,))
            row = cur.fetchone()
            if not row:
                return None
            if self.auth_mode == "sqlite":
                return dict(row)
            cols = [c[0] for c in cur.description]
            return dict(zip(cols, row))
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def get_tenant(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            query = "SELECT tenant_id, display_name, plan, subscription_status, period_end FROM dbo.Tenants WHERE tenant_id = ?" if self.auth_mode != "sqlite" else "SELECT tenant_id, display_name, plan, subscription_status, period_end FROM Tenants WHERE tenant_id = ?"
            cur.execute(query, (tenant_id,))
            row = cur.fetchone()
            if not row:
                return None
            if self.auth_mode == "sqlite":
                return dict(row)
            cols = [c[0] for c in cur.description]
            return dict(zip(cols, row))
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def seed_users_and_tenants(self, tenants: List[Dict[str, Any]], users: List[Dict[str, Any]]):
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            for t in tenants:
                if self.auth_mode == "sqlite":
                    cur.execute(
                        "INSERT OR REPLACE INTO Tenants (tenant_id, display_name, plan, subscription_status, period_end) VALUES (?, ?, ?, ?, ?)",
                        (t["tenant_id"], t["display_name"], t["plan"], t["subscription_status"], t.get("period_end")),
                    )
                else:
                    cur.execute(
                        """
                        IF NOT EXISTS (SELECT 1 FROM dbo.Tenants WHERE tenant_id = ?)
                            INSERT INTO dbo.Tenants (tenant_id, display_name, plan, subscription_status, period_end) VALUES (?, ?, ?, ?, ?)
                        ELSE
                            UPDATE dbo.Tenants SET display_name = ?, plan = ?, subscription_status = ?, period_end = ? WHERE tenant_id = ?
                        """,
                        (t["tenant_id"], t["tenant_id"], t["display_name"], t["plan"], t["subscription_status"], t.get("period_end"),
                         t["display_name"], t["plan"], t["subscription_status"], t.get("period_end"), t["tenant_id"])
                    )
            for u in users:
                if self.auth_mode == "sqlite":
                    cur.execute(
                        "INSERT OR REPLACE INTO Users (user_id, tenant_id, email, display_name, role, password_hash, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (u["user_id"], u["tenant_id"], u["email"], u["display_name"], u["role"], u["password_hash"], u.get("is_active", 1)),
                    )
                else:
                    cur.execute(
                        """
                        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE user_id = ?)
                            INSERT INTO dbo.Users (user_id, tenant_id, email, display_name, role, password_hash, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)
                        ELSE
                            UPDATE dbo.Users SET tenant_id = ?, email = ?, display_name = ?, role = ?, password_hash = ?, is_active = ? WHERE user_id = ?
                        """,
                        (u["user_id"], u["user_id"], u["tenant_id"], u["email"], u["display_name"], u["role"], u["password_hash"], u.get("is_active", 1),
                         u["tenant_id"], u["email"], u["display_name"], u["role"], u["password_hash"], u.get("is_active", 1), u["user_id"])
                    )
            conn.commit()
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def get_run_by_key(self, tenant_id: str, key: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            table = "dbo.Runs" if self.auth_mode != "sqlite" else "Runs"
            query = f"SELECT run_id, status, input_fingerprint, operation, row_count, valid_rows, invalid_rows, result_blob_path, error_code, error_message, created_at, finished_at FROM {table} WHERE tenant_id = ? AND idempotency_key = ?"
            cur.execute(query, (tenant_id, key))
            row = cur.fetchone()
            if not row:
                return None
            if self.auth_mode == "sqlite":
                return dict(row)
            cols = [c[0] for c in cur.description]
            return dict(zip(cols, row))
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def accept_run(
        self,
        run_id: str,
        tenant_id: str,
        idempotency_key: str,
        input_fingerprint: str,
        operation: str,
        user_id: str,
        row_count: int,
        limit: int,
    ) -> str:
        """
        Executes atomic accept transaction per docs/04_DATABASE.md Section 6.1
        Returns: 'ACCEPTED', 'QUOTA_EXHAUSTED', or 'DUPLICATE_KEY'
        """
        conn = self._get_connection()
        today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if self.auth_mode == "sqlite":
            import time
            for attempt in range(10):
                try:
                    cur = conn.cursor()
                    cur.execute("BEGIN IMMEDIATE")

                    # (a) Idempotency insertion
                    try:
                        cur.execute(
                            "INSERT INTO Runs (run_id, tenant_id, idempotency_key, input_fingerprint, operation, status, submitted_by, row_count, created_at) "
                            "VALUES (?, ?, ?, ?, ?, 'Running', ?, ?, ?)",
                            (run_id, tenant_id, idempotency_key, input_fingerprint, operation, user_id, row_count, now_str)
                        )
                    except sqlite3.IntegrityError:
                        conn.rollback()
                        return "DUPLICATE_KEY"

                    # (b) Daily usage row existence
                    cur.execute(
                        "INSERT OR IGNORE INTO DailyUsage (tenant_id, usage_date, used_count, updated_at) VALUES (?, ?, 0, ?)",
                        (tenant_id, today_str, now_str)
                    )

                    # (c) Conditional increment
                    cur.execute(
                        "UPDATE DailyUsage SET used_count = used_count + 1, updated_at = ? "
                        "WHERE tenant_id = ? AND usage_date = ? AND used_count < ?",
                        (now_str, tenant_id, today_str, limit)
                    )

                    if cur.rowcount == 0:
                        conn.rollback()
                        return "QUOTA_EXHAUSTED"

                    conn.commit()
                    return "ACCEPTED"
                except sqlite3.OperationalError as op_err:
                    conn.rollback()
                    if "locked" in str(op_err).lower() or "busy" in str(op_err).lower():
                        time.sleep(0.01 * (attempt + 1))
                        continue
                    raise
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    pass
            # If exhausted retries
            return "QUOTA_EXHAUSTED"
        else:
            # MSSQL T-SQL transaction with UPDLOCK, HOLDLOCK
            cur = conn.cursor()
            try:
                # First check for duplicate key to avoid rolling back transaction
                cur.execute(
                    "SELECT 1 FROM dbo.Runs WITH (NOLOCK) WHERE tenant_id = ? AND idempotency_key = ?",
                    (tenant_id, idempotency_key)
                )
                if cur.fetchone():
                    return "DUPLICATE_KEY"

                tsql = """
                SET XACT_ABORT ON;
                BEGIN TRAN;
                INSERT INTO dbo.Runs (run_id, tenant_id, idempotency_key, input_fingerprint,
                                      operation, status, submitted_by, row_count)
                VALUES (?, ?, ?, ?, ?, 'Running', ?, ?);

                DECLARE @day DATE = CAST(SYSUTCDATETIME() AS DATE);
                IF NOT EXISTS (SELECT 1 FROM dbo.DailyUsage WITH (UPDLOCK, HOLDLOCK)
                               WHERE tenant_id = ? AND usage_date = @day)
                  INSERT INTO dbo.DailyUsage (tenant_id, usage_date, used_count) VALUES (?, @day, 0);

                UPDATE dbo.DailyUsage
                   SET used_count = used_count + 1, updated_at = SYSUTCDATETIME()
                 WHERE tenant_id = ? AND usage_date = @day AND used_count < ?;

                IF @@ROWCOUNT = 0
                BEGIN
                  ROLLBACK TRAN;
                  SELECT 'QUOTA_EXHAUSTED' AS outcome;
                  RETURN;
                END

                COMMIT TRAN;
                SELECT 'ACCEPTED' AS outcome;
                """
                cur.execute(
                    tsql,
                    (run_id, tenant_id, idempotency_key, input_fingerprint, operation, user_id, row_count,
                     tenant_id, tenant_id, tenant_id, limit)
                )
                row = cur.fetchone()
                return row[0] if row else "ACCEPTED"
            except Exception as e:
                err_str = str(e)
                if "2601" in err_str or "2627" in err_str:
                    return "DUPLICATE_KEY"
                raise
            finally:
                conn.close()

    async def finish_run(
        self,
        run_id: str,
        tenant_id: str,
        status: str,
        valid_rows: Optional[int] = None,
        invalid_rows: Optional[int] = None,
        result_blob_path: Optional[str] = None,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
    ):
        conn = self._get_connection()
        now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
        try:
            cur = conn.cursor()
            table = "dbo.Runs" if self.auth_mode != "sqlite" else "Runs"
            query = f"""
            UPDATE {table}
               SET status = ?, valid_rows = ?, invalid_rows = ?,
                   result_blob_path = ?, error_code = ?, error_message = ?,
                   finished_at = {'SYSUTCDATETIME()' if self.auth_mode != 'sqlite' else '?'}
             WHERE run_id = ? AND tenant_id = ? AND status = 'Running'
            """
            params = (status, valid_rows, invalid_rows, result_blob_path, error_code, error_message)
            if self.auth_mode == "sqlite":
                params = params + (now_str, run_id, tenant_id)
            else:
                params = params + (run_id, tenant_id)
            cur.execute(query, params)
            conn.commit()
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def list_runs(self, tenant_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            table = "dbo.Runs" if self.auth_mode != "sqlite" else "Runs"
            query = (
                f"SELECT TOP (?) run_id, operation, status, row_count, valid_rows, invalid_rows, created_at, finished_at "
                f"FROM {table} WHERE tenant_id = ? ORDER BY created_at DESC"
                if self.auth_mode != "sqlite" else
                f"SELECT run_id, operation, status, row_count, valid_rows, invalid_rows, created_at, finished_at "
                f"FROM {table} WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?"
            )
            params = (limit, tenant_id) if self.auth_mode != "sqlite" else (tenant_id, limit)
            cur.execute(query, params)
            rows = cur.fetchall()
            if self.auth_mode == "sqlite":
                return [dict(r) for r in rows]
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, r)) for r in rows]
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def get_run_by_id(self, tenant_id: str, run_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            table = "dbo.Runs" if self.auth_mode != "sqlite" else "Runs"
            query = f"SELECT * FROM {table} WHERE run_id = ? AND tenant_id = ?"
            cur.execute(query, (run_id, tenant_id))
            row = cur.fetchone()
            if not row:
                return None
            if self.auth_mode == "sqlite":
                return dict(row)
            cols = [c[0] for c in cur.description]
            return dict(zip(cols, row))
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def get_subscription_snapshot(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        try:
            cur = conn.cursor()
            if self.auth_mode == "sqlite":
                query = """
                SELECT t.tenant_id, t.display_name, t.plan, t.subscription_status, t.period_end,
                       COALESCE(u.used_count, 0) AS used_today
                  FROM Tenants t
                  LEFT JOIN DailyUsage u
                    ON u.tenant_id = t.tenant_id AND u.usage_date = ?
                 WHERE t.tenant_id = ?
                """
                cur.execute(query, (today_str, tenant_id))
            else:
                query = """
                SELECT t.tenant_id, t.display_name, t.plan, t.subscription_status, t.period_end,
                       ISNULL(u.used_count, 0) AS used_today
                  FROM dbo.Tenants t
                  LEFT JOIN dbo.DailyUsage u
                    ON u.tenant_id = t.tenant_id AND u.usage_date = CAST(SYSUTCDATETIME() AS DATE)
                 WHERE t.tenant_id = ?
                """
                cur.execute(query, (tenant_id,))
            row = cur.fetchone()
            if not row:
                return None
            if self.auth_mode == "sqlite":
                return dict(row)
            cols = [c[0] for c in cur.description]
            return dict(zip(cols, row))
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def create_pledge(self, pledge: Dict[str, Any]) -> None:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            table = "dbo.Pledges" if self.auth_mode != "sqlite" else "Pledges"
            query = f"""
            INSERT INTO {table} (pledge_id, tenant_id, created_by, target_plan, amount_minor, currency, status, receipt_no, receipt_sig, created_at, settled_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            cur.execute(
                query,
                (
                    pledge["pledge_id"],
                    pledge["tenant_id"],
                    pledge["created_by"],
                    pledge["target_plan"],
                    pledge["amount_minor"],
                    pledge.get("currency", "INR"),
                    pledge["status"],
                    pledge.get("receipt_no"),
                    pledge.get("receipt_sig"),
                    pledge["created_at"],
                    pledge.get("settled_at"),
                    pledge["expires_at"],
                ),
            )
            conn.commit()
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def get_pledge(self, tenant_id: str, pledge_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            table = "dbo.Pledges" if self.auth_mode != "sqlite" else "Pledges"
            query = f"SELECT * FROM {table} WHERE pledge_id = ? AND tenant_id = ?"
            cur.execute(query, (pledge_id, tenant_id))
            row = cur.fetchone()
            if not row:
                return None
            if self.auth_mode == "sqlite":
                return dict(row)
            cols = [c[0] for c in cur.description]
            return dict(zip(cols, row))
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def update_pledge_and_plan(
        self,
        tenant_id: str,
        pledge_id: str,
        status: str,
        receipt_no: Optional[str],
        receipt_sig: Optional[str],
        settled_at: Optional[str],
        upgrade_plan: Optional[str] = None,
    ) -> None:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            pledges_table = "dbo.Pledges" if self.auth_mode != "sqlite" else "Pledges"
            tenants_table = "dbo.Tenants" if self.auth_mode != "sqlite" else "Tenants"

            cur.execute(
                f"""
                UPDATE {pledges_table}
                   SET status = ?, receipt_no = ?, receipt_sig = ?, settled_at = ?
                 WHERE pledge_id = ? AND tenant_id = ?
                """,
                (status, receipt_no, receipt_sig, settled_at, pledge_id, tenant_id),
            )
            if upgrade_plan:
                cur.execute(
                    f"UPDATE {tenants_table} SET plan = ? WHERE tenant_id = ?",
                    (upgrade_plan, tenant_id),
                )
            conn.commit()
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()

    async def get_tenant_receipts(self, tenant_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            table = "dbo.Pledges" if self.auth_mode != "sqlite" else "Pledges"
            query = f"SELECT * FROM {table} WHERE tenant_id = ? AND status = 'settled' ORDER BY settled_at DESC"
            cur.execute(query, (tenant_id,))
            rows = cur.fetchall()
            if not rows:
                return []
            if self.auth_mode == "sqlite":
                return [dict(r) for r in rows]
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, r)) for r in rows]
        finally:
            if self._sqlite_mem_conn is None:
                conn.close()


def get_sql_client() -> SqlClient:
    global _CLIENT_INSTANCE
    if _CLIENT_INSTANCE is None:
        _CLIENT_INSTANCE = SqlClient()
    return _CLIENT_INSTANCE
