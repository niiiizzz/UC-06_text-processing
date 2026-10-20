import asyncio
from app.config import settings
from app.auth import hash_password
from app.adapters.sql import get_sql_client

SEEDED_TENANTS = [
    {
        "tenant_id": "tnt_a",
        "display_name": "Northwind Print Co.",
        "plan": "Pro",
        "subscription_status": "Active",
        "period_end": "2026-12-31",
    },
    {
        "tenant_id": "tnt_b",
        "display_name": "Harbor & Pine Labs",
        "plan": "Basic",
        "subscription_status": "Active",
        "period_end": "2026-12-31",
    },
]


def build_seeded_users(password: str):
    pw_hash = hash_password(password)
    return [
        {
            "user_id": "usr_a_op",
            "tenant_id": "tnt_a",
            "email": "op.a@lathe.test",
            "display_name": "Tenant A Operator",
            "role": "Operator",
            "password_hash": pw_hash,
            "is_active": 1,
        },
        {
            "user_id": "usr_a_vw",
            "tenant_id": "tnt_a",
            "email": "view.a@lathe.test",
            "display_name": "Tenant A Viewer",
            "role": "Viewer",
            "password_hash": pw_hash,
            "is_active": 1,
        },
        {
            "user_id": "usr_b_op",
            "tenant_id": "tnt_b",
            "email": "op.b@lathe.test",
            "display_name": "Tenant B Operator",
            "role": "Operator",
            "password_hash": pw_hash,
            "is_active": 1,
        },
        {
            "user_id": "usr_b_vw",
            "tenant_id": "tnt_b",
            "email": "view.b@lathe.test",
            "display_name": "Tenant B Viewer",
            "role": "Viewer",
            "password_hash": pw_hash,
            "is_active": 1,
        },
    ]


async def seed_database():
    print("[*] Seeding database with synthetic sandbox fixtures...")
    sql = get_sql_client()
    users = build_seeded_users(settings.SEED_PASSWORD)
    await sql.seed_users_and_tenants(SEEDED_TENANTS, users)
    print(f"[+] Successfully seeded {len(SEEDED_TENANTS)} tenants and {len(users)} users.")


if __name__ == "__main__":
    asyncio.run(seed_database())
