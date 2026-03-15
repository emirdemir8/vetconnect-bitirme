#!/bin/sh
# BITIRME - Backend API (FastAPI). Proje kökünde çalıştırın.
echo "Backend başlatılıyor: http://127.0.0.1:8000"
echo "API dokümantasyonu: http://127.0.0.1:8000/docs"
echo ""
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
