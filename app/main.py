from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from routes.appointments import router as appointments_router
from routes.auth import router as auth_router
from routes.cases import router as cases_router
from routes.data_demo import router as data_router
from routes.health import router as health_router
from routes.pets import router as pets_router
from routes.stats import router as stats_router
from routes.symptom_reports import router as symptom_reports_router
from routes.vaccine_types import router as vaccine_types_router
from routes.vet import router as vet_router


def create_app() -> FastAPI:
    app = FastAPI(title="BITIRME API")

    # CORS: frontend (Vite) ve farklı portlar için
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://localhost:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API router'ları
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(pets_router)
    app.include_router(appointments_router)
    app.include_router(vaccine_types_router)
    app.include_router(cases_router)
    app.include_router(stats_router)
    app.include_router(symptom_reports_router)
    app.include_router(data_router)
    app.include_router(vet_router)

    # Frontend statik dosyaları (index.html)
    app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

    @app.get("/", response_class=HTMLResponse)
    def root_ui():
        # Basit redirect benzeri: kullanıcıyı frontend ana sayfasına yönlendir
        with open("frontend/index.html", "r", encoding="utf-8") as f:
            return f.read()

    return app


app = create_app()
