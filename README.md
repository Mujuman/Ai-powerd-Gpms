# AI-GPMS

AI-Powered Graduation Project Management System for university graduation-project workflows.

## Development status

Phase 3 provides MySQL migrations, exactly five seeded login roles, JWT-based API authentication, rotating database-backed refresh sessions, password changes and reset flow, login/audit records, role middleware, and one-time initial administrator bootstrap. Academic modules and AI analysis endpoints are not implemented yet.

## Architecture

- `frontend/`: React, Vite, TypeScript, Tailwind CSS, and the planned client-side libraries.
- `backend/`: Express API with MySQL2 connection pooling and health/readiness endpoints.
- `ai-service/`: Internal FastAPI service and Celery worker configuration.
- MySQL and Redis are private to the Compose network. MySQL is optionally reachable from the host on loopback for local development.

## Requirements

- Node.js 22 or newer and npm.
- Docker Desktop with Docker Compose for the complete stack.
- Python 3.11 or newer only if running the AI service outside Docker.

## Start the containerized development stack

1. Copy `.env.example` to `.env`.
2. Set unique MySQL passwords and replace `JWT_ACCESS_SECRET` with a random secret of at least 32 bytes. In PowerShell, generate one with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. From the repository root, run:

   ```powershell
   docker compose up --build
   ```

4. In a second terminal, set temporary administrator bootstrap values and create the initial account:

   ```powershell
   $env:BOOTSTRAP_ADMIN_EMAIL = "admin@example.edu"
   $env:BOOTSTRAP_ADMIN_NAME = "System Administrator"
   $env:BOOTSTRAP_ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
   docker compose exec -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_PASSWORD backend npm run db:bootstrap-admin
   Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_NAME, Env:BOOTSTRAP_ADMIN_PASSWORD
   ```

5. Open `http://localhost:5173`. Check the API at `http://localhost:3000/health` and database readiness at `http://localhost:3000/ready`.

The API applies pending migrations and seeds the five roles before listening. The admin bootstrap command is one-time and refuses to run once any System Administrator exists. The frontend is served by Vite in development mode. MySQL data, Redis data, and uploaded files use named Docker volumes. Compose does not publish Redis or the AI service to the host.

To stop the stack without deleting persistent data:

```powershell
docker compose down
```

## Run the frontend and API on the host

Install packages from the repository root:

```powershell
npm install
npm --prefix frontend install
npm --prefix backend install
```

Set the backend environment variables in the current PowerShell session, including a unique JWT secret. Apply migrations and role seeds before creating an administrator:

```powershell
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3306"
$env:DB_NAME = "ai_gpms"
$env:DB_USER = "ai_gpms_app"
$env:DB_PASSWORD = "your-local-password"
$env:JWT_ACCESS_SECRET = (node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
$env:FRONTEND_ORIGIN = "http://localhost:5173"
npm --prefix backend run db:setup
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@example.edu"
$env:BOOTSTRAP_ADMIN_NAME = "System Administrator"
$env:BOOTSTRAP_ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
npm --prefix backend run db:bootstrap-admin
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_NAME, Env:BOOTSTRAP_ADMIN_PASSWORD
npm --prefix backend run dev
```

Run the frontend command below in a second terminal.

```powershell
npm --prefix frontend run dev
```

The host-mode API expects a running MySQL instance. The Vite development proxy sends `/api` requests to `http://localhost:3000` unless `VITE_API_PROXY_TARGET` is set.

## Useful commands

```powershell
npm --prefix frontend run build
npm --prefix backend test
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
npm --prefix backend start
docker compose ps
```

## Authentication API

- `POST /api/auth/login` — email and password; returns a short-lived access token and sets an HTTP-only refresh cookie.
- `POST /api/auth/refresh` — rotates the refresh cookie; reuse of a revoked token revokes its token family.
- `POST /api/auth/logout` — revokes the refresh-token family and clears the cookie.
- `GET /api/auth/me` — returns the active account and its current role/department assignments; send the access token as a Bearer token.
- `POST /api/auth/change-password` — changes the current password, revokes prior refresh sessions, and starts a fresh session.
- `POST /api/auth/password-reset/request` and `/confirm` — one-time email reset flow; SMTP must be configured for requests.

Login failures, refresh/session events, password changes, and reset events are written to `login_attempts` and/or `audit_logs`. Access authorization reloads the active user and role from MySQL, so deactivated accounts lose access without waiting for token expiry. Department/project authorization is added with the academic modules in later phases.
