import os
import glob
from app.config import settings
from app.adapters.sql import get_sql_client

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "migrations")


def run_migrations():
    print(f"[*] Running database migrations (mode={settings.SQL_AUTH_MODE})...")
    sql = get_sql_client()

    sql_files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))
    if not sql_files:
        print("[!] No migration files found in migrations/ directory.")
        return

    if settings.SQL_AUTH_MODE == "sqlite":
        # SQLite schema initialized via SqlClient._init_sqlite()
        print("[*] SQLite adapter schema verified.")
        return

    conn = sql._get_connection()
    try:
        cur = conn.cursor()
        for filepath in sql_files:
            filename = os.path.basename(filepath)
            print(f"[*] Applying {filename}...")
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            # Split statements if necessary or execute whole block
            # For T-SQL scripts with IF OBJECT_ID(...) IS NULL, execute per file
            batches = [b.strip() for b in content.split("GO") if b.strip()]
            if not batches:
                batches = [content]

            for b in batches:
                cur.execute(b)
            conn.commit()
            print(f"[+] Applied {filename} successfully.")
    finally:
        conn.close()
    print("[*] All migrations applied.")


if __name__ == "__main__":
    run_migrations()
