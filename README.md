# AI-GPMS

AI-Powered Graduation Project Management System for university graduation-project workflows.

## Development status

This repository is being built in phases. Phase 2 establishes the frontend, API, AI-service, task-worker, and container foundations. Authentication, database migrations, academic modules, and AI analysis endpoints are not implemented yet.

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
2. Replace both MySQL password placeholders with strong, unique values.
3. From the repository root, run:

   ```powershell
   docker compose up --build
   ```

4. Open `http://localhost:5173`. Check the API at `http://localhost:3000/health` and database readiness at `http://localhost:3000/ready`.

The frontend is served by Vite in development mode. MySQL data, Redis data, and uploaded files use named Docker volumes. Compose does not publish Redis or the AI service to the host.

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

Set the backend environment variables in the current PowerShell session, then start the services in separate terminals:

```powershell
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3306"
$env:DB_NAME = "ai_gpms"
$env:DB_USER = "ai_gpms_app"
$env:DB_PASSWORD = "your-local-password"
$env:FRONTEND_ORIGIN = "http://localhost:5173"
npm --prefix backend run dev
```

```powershell
npm --prefix frontend run dev
```

The host-mode API expects a running MySQL instance. The Vite development proxy sends `/api` requests to `http://localhost:3000` unless `VITE_API_PROXY_TARGET` is set.

## Useful commands

```powershell
npm --prefix frontend run build
npm --prefix backend start
docker compose ps
```

There are no database migrations or seed records in this phase; schema setup is part of Phase 3.
