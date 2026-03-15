@echo off
REM BITIRME - Backend API (FastAPI)
cd /d "%~dp0"
echo Backend baslatiliyor: http://127.0.0.1:8000
echo API dokumantasyonu: http://127.0.0.1:8000/docs
echo.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause
