import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from scripts.seed import seed_database


@pytest.mark.asyncio
async def test_auth_flow_seeded_users():
    # Use SQLite for standalone unit test
    settings.SQL_AUTH_MODE = "sqlite"
    settings.SQLITE_PATH = ":memory:"
    from app.adapters import sql as sql_module
    sql_module._CLIENT_INSTANCE = None  # reset client singleton to pick up memory db

    await seed_database()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated /auth/me returns 401
        res = await client.get("/auth/me")
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "UNAUTHENTICATED"

        # 2. Login with bad credentials returns 401
        res = await client.post(
            "/auth/login",
            json={"email": "op.a@lathe.test", "password": "wrong_password"},
        )
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "UNAUTHENTICATED"

        # 3. Login with good credentials for Tenant A Operator returns 200 + token + cookie
        res = await client.post(
            "/auth/login",
            json={"email": "op.a@lathe.test", "password": settings.SEED_PASSWORD},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["tenant_id"] == "tnt_a"
        assert data["role"] == "Operator"
        assert "token" in data
        assert "lathe_session" in res.cookies

        token = data["token"]

        # 4. Auth me with Bearer header
        me_res = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["tenant_id"] == "tnt_a"
        assert me_data["role"] == "Operator"

        # 5. Auth me with cookie
        client.cookies.set("lathe_session", token)
        me_cookie_res = await client.get("/auth/me")
        assert me_cookie_res.status_code == 200
        assert me_cookie_res.json()["tenant_id"] == "tnt_a"

        # 6. Verify all 4 seeded users can log in
        seeded = [
            ("op.a@lathe.test", "tnt_a", "Operator"),
            ("view.a@lathe.test", "tnt_a", "Viewer"),
            ("op.b@lathe.test", "tnt_b", "Operator"),
            ("view.b@lathe.test", "tnt_b", "Viewer"),
        ]
        for email, tid, role in seeded:
            r = await client.post(
                "/auth/login",
                json={"email": email, "password": settings.SEED_PASSWORD},
            )
            assert r.status_code == 200
            assert r.json()["tenant_id"] == tid
            assert r.json()["role"] == role
