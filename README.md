# UniMak Campus Study Hub

This project contains the existing React/Vite frontend and a Python/FastAPI backend in `backend\`. The backend connects to Supabase Auth, PostgreSQL, and private Storage.

## Run the frontend

```powershell
npm install
$env:VITE_API_URL="http://localhost:8000"
npm run dev
```

The frontend API uses `VITE_API_URL` (defaults to `http://localhost:8000`). Authentication, profile updates, bookmarks, uploads, downloads, and catalogue data require the backend and configured Supabase project.

Build for production with:

```powershell
npm run build
```

## Run the backend

Follow [backend/README.md](./backend/README.md). In brief:

```powershell
Set-Location C:\campus-study-hub\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Before using the API, set backend-only Supabase keys in `backend\.env` and run [`backend/supabase/schema.sql`](./backend/supabase/schema.sql) in the Supabase SQL Editor. Swagger docs: `http://localhost:8000/docs`; health: `http://localhost:8000/health`.

## Main structure

- `src/pages`, `src/components`: React UI
- `src/api/client.js`: Axios HTTP client for the FastAPI API
- `src/auth/AuthContext.jsx`: authentication and profile state
- `src/library`: resource and bookmark state
- `public/images`: frontend image assets
- `backend/app`: FastAPI application and endpoints
- `backend/supabase/schema.sql`: PostgreSQL tables, triggers, RLS and Storage setup
