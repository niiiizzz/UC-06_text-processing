import sys
import argparse
import datetime
from app.config import settings
from app.adapters.sql import get_sql_client


def assert_sandbox_environment():
    if settings.APP_ENV not in ("dev", "test"):
        print(f"[!] Refusing to run harness in non-sandbox environment: {settings.APP_ENV}")
        sys.exit(1)


def reset_all():
    assert_sandbox_environment()
    sql = get_sql_client()
    conn = sql._get_connection()
    try:
        cur = conn.cursor()
        t_runs = "dbo.Runs" if sql.auth_mode != "sqlite" else "Runs"
        t_du = "dbo.DailyUsage" if sql.auth_mode != "sqlite" else "DailyUsage"
        cur.execute(f"DELETE FROM {t_runs}")
        cur.execute(f"DELETE FROM {t_du}")
        conn.commit()
        print("[+] Reset complete: Runs and DailyUsage cleared.")
    finally:
        conn.close()


def reset_tenant(tenant_id: str):
    assert_sandbox_environment()
    sql = get_sql_client()
    conn = sql._get_connection()
    try:
        cur = conn.cursor()
        t_runs = "dbo.Runs" if sql.auth_mode != "sqlite" else "Runs"
        t_du = "dbo.DailyUsage" if sql.auth_mode != "sqlite" else "DailyUsage"
        cur.execute(f"DELETE FROM {t_runs} WHERE tenant_id = ?", (tenant_id,))
        cur.execute(f"DELETE FROM {t_du} WHERE tenant_id = ?", (tenant_id,))
        conn.commit()
        print(f"[+] Reset complete for tenant {tenant_id}.")
    finally:
        conn.close()


def set_subscription_status(tenant_id: str, status: str):
    assert_sandbox_environment()
    if status not in ("Active", "Suspended"):
        print("[!] Status must be Active or Suspended")
        sys.exit(1)
    sql = get_sql_client()
    conn = sql._get_connection()
    try:
        cur = conn.cursor()
        t_tnt = "dbo.Tenants" if sql.auth_mode != "sqlite" else "Tenants"
        cur.execute(f"UPDATE {t_tnt} SET subscription_status = ? WHERE tenant_id = ?", (status, tenant_id))
        conn.commit()
        print(f"[+] Tenant {tenant_id} subscription set to {status}.")
    finally:
        conn.close()


def set_plan(tenant_id: str, plan: str):
    assert_sandbox_environment()
    if plan not in ("Basic", "Pro"):
        print("[!] Plan must be Basic or Pro")
        sys.exit(1)
    sql = get_sql_client()
    conn = sql._get_connection()
    try:
        cur = conn.cursor()
        t_tnt = "dbo.Tenants" if sql.auth_mode != "sqlite" else "Tenants"
        cur.execute(f"UPDATE {t_tnt} SET plan = ? WHERE tenant_id = ?", (plan, tenant_id))
        conn.commit()
        print(f"[+] Tenant {tenant_id} plan set to {plan}.")
    finally:
        conn.close()


def set_quota(tenant_id: str, used_count: int):
    assert_sandbox_environment()
    sql = get_sql_client()
    conn = sql._get_connection()
    today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        cur = conn.cursor()
        if sql.auth_mode == "sqlite":
            cur.execute(
                "INSERT INTO DailyUsage (tenant_id, usage_date, used_count, updated_at) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(tenant_id, usage_date) DO UPDATE SET used_count = excluded.used_count, updated_at = excluded.updated_at",
                (tenant_id, today_str, used_count, now_str)
            )
        else:
            cur.execute("""
                MERGE dbo.DailyUsage AS d USING (SELECT ? AS tenant_id, CAST(SYSUTCDATETIME() AS DATE) AS usage_date) s
                  ON d.tenant_id = s.tenant_id AND d.usage_date = s.usage_date
                WHEN MATCHED THEN UPDATE SET used_count = ?
                WHEN NOT MATCHED THEN INSERT (tenant_id, usage_date, used_count) VALUES (s.tenant_id, s.usage_date, ?);
            """, (tenant_id, used_count, used_count))
        conn.commit()
        print(f"[+] Tenant {tenant_id} today's quota set to {used_count} used.")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Lathe Test Harness CLI (Direct DB access, dev/test only)")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # reset
    reset_parser = subparsers.add_parser("reset")
    reset_parser.add_argument("--tenant", help="Tenant ID to reset (or all if omitted)")

    # suspend
    suspend_parser = subparsers.add_parser("suspend")
    suspend_parser.add_argument("tenant", help="Tenant ID to suspend")

    # activate
    activate_parser = subparsers.add_parser("activate")
    activate_parser.add_argument("tenant", help="Tenant ID to activate")

    # set-plan
    plan_parser = subparsers.add_parser("set-plan")
    plan_parser.add_argument("tenant", help="Tenant ID")
    plan_parser.add_argument("plan", choices=["Basic", "Pro"], help="Target plan")

    # set-quota
    quota_parser = subparsers.add_parser("set-quota")
    quota_parser.add_argument("tenant", help="Tenant ID")
    quota_parser.add_argument("used", type=int, help="Used count to set")

    args = parser.parse_args()

    if args.command == "reset":
        if args.tenant:
            reset_tenant(args.tenant)
        else:
            reset_all()
    elif args.command == "suspend":
        set_subscription_status(args.tenant, "Suspended")
    elif args.command == "activate":
        set_subscription_status(args.tenant, "Active")
    elif args.command == "set-plan":
        set_plan(args.tenant, args.plan)
    elif args.command == "set-quota":
        set_quota(args.tenant, args.used)


if __name__ == "__main__":
    main()
