# VetConnect – Veterinary & Pet Owner Panel

A role-based web application for veterinary clinics and pet owners. The backend (FastAPI) and frontend (React SPA) live together in a single project.

## Requirements (install these first)

| Tool | Recommended version | Notes |
|------|--------------------|-------|
| **Python** | 3.11 or newer (tested on 3.14) | Runs the FastAPI backend. Make sure `python` and `pip` are on your PATH. |
| **Node.js** | 20 or newer (includes npm) | Builds/runs the React frontend (Vite). |
| **MongoDB** | 6 or newer (Community Server) | Database. Must be running locally at `mongodb://localhost:27017`. |

Download links:

- Python: https://www.python.org/downloads/
- Node.js: https://nodejs.org/ (LTS)
- MongoDB Community Server: https://www.mongodb.com/try/download/community

> On Windows, MongoDB can also be provided by XAMPP or run as a Windows service. Just make sure it is listening on port `27017` before starting the backend.

## Setup & run (development)

Open **two terminals** in the project root.

### 1) Backend (FastAPI) — port 8000

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2) Frontend (React + Vite) — port 5173

```bash
cd frontend
npm install
npm run dev
```

Then open the app in your browser:

- **App:** http://localhost:5173
- **API docs (Swagger):** http://127.0.0.1:8000/docs

### Configuration (optional)

Copy `.env.example` to `.env` to override defaults (database URI, JWT secret, SMTP for password-reset e-mails, etc.). Defaults work out of the box for local development, so a `.env` file is not required to run it.

### Creating an admin or veterinarian account

Public registration only creates **pet owner** accounts. Admin and veterinarian
accounts are created from a trusted environment via a script:

```bash
python scripts/create_vet_user.py --email admin@example.com --password "StrongPass123" --role admin
python scripts/create_vet_user.py --email vet@example.com --password "StrongPass123" --role vet
```

Veterinarian accounts can also be created through the in-app flow: a pet owner
submits a veterinarian application, and an admin approves it.

## Architecture & risk levels

For the detailed write-up of the **architecture**, the **risk-level system**, and the **usage scenarios**, see:

→ **[BITIRME_DOKUMANTASYON.md](./BITIRME_DOKUMANTASYON.md)**

That document covers:

- Overall architecture (backend, frontend, database, role-based access)
- Risk levels (1–5) and the "serious" logic, plus the TigressADR integration
- Veterinarian and pet-owner usage scenarios
