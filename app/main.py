from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.middleware.security import SecurityHeadersMiddleware
from app.utils.rate_limit import limiter
from routes.appointments import router as appointments_router
from routes.auth import router as auth_router
from routes.clinics import router as clinics_router
from routes.cases import router as cases_router
from routes.data_demo import router as data_router
from routes.health import router as health_router
from routes.pets import router as pets_router
from routes.stats import router as stats_router
from routes.symptom_reports import router as symptom_reports_router
from routes.vaccine_types import router as vaccine_types_router
from routes.vet import router as vet_router
from routes.vet_applications import admin_router as vet_applications_admin_router
from routes.vet_applications import router as vet_applications_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.validate()
    from app.db.indexes import ensure_indexes

    ensure_indexes()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="BITIRME API", lifespan=lifespan)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    origins = settings.cors_origins_list()
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    if settings.force_https:
        app.add_middleware(HTTPSRedirectMiddleware)
    if settings.trusted_hosts:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(clinics_router)
    app.include_router(pets_router)
    app.include_router(appointments_router)
    app.include_router(vaccine_types_router)
    app.include_router(cases_router)
    app.include_router(stats_router)
    app.include_router(symptom_reports_router)
    app.include_router(data_router)
    app.include_router(vet_router)
    app.include_router(vet_applications_router)
    app.include_router(vet_applications_admin_router)

    import pathlib

    project_root = pathlib.Path(__file__).resolve().parents[1]
    dist_dir = project_root / "frontend" / "dist"
    dev_dir = project_root / "frontend"
    # Üretimde yalnızca build çıktısı (dist) sunulur; ham kaynak kodu ifşa edilmez.
    spa_dir = dist_dir if dist_dir.is_dir() else dev_dir
    index_path = spa_dir / "index.html"

    app.mount("/frontend", StaticFiles(directory=str(spa_dir)), name="frontend")

    @app.get("/", response_class=HTMLResponse)
    def root_ui():
        if not index_path.is_file():
            return HTMLResponse("<h1>Frontend build not found.</h1>", status_code=404)
        return index_path.read_text(encoding="utf-8")

    return app


app = create_app()
