# Campus Study Hub API

FastAPI backend for the existing React/Vite app. Supabase URL and keys belong in the backend environment only; the service-role key must never be exposed as a `VITE_*` variable.

## Local setup

From PowerShell:

```powershell
Set-Location C:\campus-study-hub\backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The health endpoint is `http://localhost:8000/health`; interactive API documentation is at `http://localhost:8000/docs`.

Set the Supabase project URL, anon key, and service-role key in the ignored `backend/.env` file. Obtain them from **Supabase Dashboard → Project Settings → API**. Never put the service-role key in the React `.env` or any `VITE_*` setting.

Run [`supabase/schema.sql`](./supabase/schema.sql) in **Supabase Dashboard → SQL Editor**. It creates the tables, seed departments, profile trigger, RLS policies and private `study-materials` bucket. It also creates profiles for Auth accounts that were registered before the schema was installed. After registering and confirming the designated administrator account, run this once in the SQL Editor, replacing the email:

```sql
select public.provision_initial_admin('admin@example.com');
```

The function refuses to provision a second administrator. Every public sign-up is assigned the student role by the database trigger.

Registration creates the Supabase Auth account and its database profile. If email confirmation is enabled in the Supabase project's Auth settings, users must follow the confirmation link before signing in; the registration page asks them to check their email.

Supabase's built-in email sender has low sending limits. If registration returns an email rate-limit message, do not repeatedly retry: check the inbox/spam folder for a previously sent confirmation, then wait for the limit to reset. For reliable ongoing use, configure a custom SMTP provider under **Supabase Dashboard → Authentication → SMTP Settings**. SMTP credentials are project secrets and must be entered only in the Supabase dashboard, never committed to this repository.

The FastAPI API maps the existing React `/api/auth`, `/api/resources`, `/api/bookmarks`, `/api/admin`, `/api/courses`, and `/api/departments` requests. Supabase Auth access and refresh tokens are held in HttpOnly cookies; unsafe requests also require a CSRF token. Configure `SESSION_COOKIE_SECURE=true` and `SESSION_COOKIE_SAME_SITE=none` when the frontend and API are on different HTTPS sites.

The `.env.example` contains placeholders only. Actual Supabase project credentials are not committed.

## Run tests

```powershell
python -m pytest
```
