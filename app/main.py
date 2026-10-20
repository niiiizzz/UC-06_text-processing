from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.errors import TextForgeError, textforge_error_handler
from app.middleware import RequestIdAndTenantOverrideMiddleware
from app.routers import health, auth, tools, subscription, runs


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

    # Routers
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(tools.router)
    app.include_router(subscription.router)
    app.include_router(runs.router)

    from app.routers import billing
    app.include_router(billing.router)

    return app


app = create_app()
