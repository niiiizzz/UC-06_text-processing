from fastapi import FastAPI
from app.config import settings
from app.errors import TextForgeError, textforge_error_handler
from app.middleware import RequestIdAndTenantOverrideMiddleware
from app.routers import health, auth, tools, subscription, runs


# Tenant plan definitions — ground truth for the app
# Basic: 3 daily runs | Pro: 10 daily runs
SEED_TENANTS = [
    {"tenant_id": "tnt_a", "display_name": "Northwind Print Co.", "plan": "Pro",   "subscription_status": "Active", "period_end": "2026-12-31"},
    {"tenant_id": "tnt_b", "display_name": "Harbor & Pine Labs",  "plan": "Basic", "subscription_status": "Active", "period_end": "2026-12-31"},
]


def _enforce_plans():
    """Enforce correct tenant plans on startup (idempotent)."""
    import sqlite3, os
    db_path = settings.SQLITE_PATH
    if not db_path or db_path == ":memory:" or settings.SQL_AUTH_MODE != "sqlite":
        return
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        for t in SEED_TENANTS:
            cur.execute(
                "UPDATE Tenants SET plan = ?, subscription_status = ? WHERE tenant_id = ?",
                (t["plan"], t["subscription_status"], t["tenant_id"]),
            )
        conn.commit()
        conn.close()
        print(f"[startup] Tenant plans enforced: {[(t['tenant_id'], t['plan']) for t in SEED_TENANTS]}")
    except Exception as e:
        print(f"[startup] Warning: could not enforce plans: {e}")


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.PROJECT_NAME} API",
        version=settings.VERSION,
        docs_url="/docs" if settings.APP_ENV == "dev" else None,
        redoc_url=None,
    )

    # Error envelope exception handler
    app.add_exception_handler(TextForgeError, textforge_error_handler)

    # Core middleware (Request ID + Tenant Override Guard)
    app.add_middleware(RequestIdAndTenantOverrideMiddleware)

    # Enforce correct tenant plans at boot
    _enforce_plans()

    # Routers
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(tools.router)
    app.include_router(subscription.router)
    app.include_router(runs.router)

    from app.routers import billing
    app.include_router(billing.router)

    # Mount static assets & SPA fallback
    import os
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse, HTMLResponse

    static_dir = os.path.join(os.path.dirname(__file__), "static")

    # Mount /assets for hashed JS/CSS bundles
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    _fallback_html = "<html><body><h1>TextForge API is running</h1><p>Frontend assets not found.</p></body></html>"

    # Explicit root route - must be registered before catch-all
    @app.get("/", include_in_schema=False)
    async def serve_root():
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return HTMLResponse(_fallback_html)

    # SPA catch-all for client-side routing
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = os.path.join(static_dir, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return HTMLResponse(_fallback_html)

    return app


app = create_app()
