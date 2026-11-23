# AI-GPMS

AI-Powered Graduation Project Management System for university graduation-project workflows.

## Current implementation status

The current implementation includes five seeded roles, JWT authentication, rotating refresh sessions, password changes and reset support, audit/login records, department and user administration, academic calendars, student registration and spreadsheet import, configurable eligibility rules and history, and department-scoped project groups. The Department Head project lifecycle includes student proposal submission and approval, similarity analysis, advisor/examiner management and matching, defense scheduling, examiner assessments, and department progress reports. Student project pages support editable local keyword-template title drafts, advisor messaging, private PDF/DOCX uploads, defense-correction uploads after a revision request, and viewing schedules and examiner outcomes. The AI service provides sentence-embedding similarity when configured; without it, the API explicitly labels and uses a local TF-IDF lexical baseline.

Project documents are stored outside the public web root in `backend\storage\project-documents` by default. Keep that folder private and backed up as needed; `PROJECT_DOCUMENT_ROOT` can point to another private local directory. Run `npm --prefix backend run db:migrate` after updating to create the collaboration tables, staff-interest columns, and student workflow fields. Title drafts are deterministic templates, not generative AI, and similarity scores are advisory rather than automatic originality decisions.

API rate limits are disabled when `NODE_ENV=development` to simplify local testing. Rate limits remain enabled in other environments.

## Technology and local requirements

- Node.js 22.9+ and npm.
- MySQL 8+ or XAMPP MariaDB 10.4+ (the local academic migrations and core queries are verified with MariaDB 10.4).
- Python 3.11+.
- Redis, recommended through WSL2 on Windows.
- Celery worker running in WSL2/Linux, not as a native Windows process.

All services run as local processes. Frontend and API development servers bind to `127.0.0.1` by default.

## Windows setup

1. Install Node.js, Python 3.11+, XAMPP/MySQL, and WSL2 with Ubuntu. Start MySQL in XAMPP.
2. Create the local database in phpMyAdmin or a MySQL client:

   ```sql
   CREATE DATABASE ai_powerd_gpms_db
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

   Create a dedicated account when possible, and set the same password in `backend\.env`:

   ```sql
   CREATE USER 'ai_gpms_app'@'127.0.0.1' IDENTIFIED BY 'replace-with-a-unique-password';
   GRANT ALL PRIVILEGES ON `ai_powerd_gpms_db`.* TO 'ai_gpms_app'@'127.0.0.1';
   ```

   For an existing local XAMPP installation, its configured MySQL account can also be used for development.

3. From the repository root, install the JavaScript packages and create the AI virtual environment:

   ```powershell
   .\scripts\setup-windows.ps1
   ```

   To also install the large AI/ML Python dependencies:

   ```powershell
   .\scripts\setup-windows.ps1 -InstallAiDependencies
   ```

4. Edit `backend\.env`. The setup script creates it from `.env.example` only when it does not already exist. Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` for your local database, and replace `JWT_ACCESS_SECRET` with a random value of at least 32 bytes. Keep this file private and do not commit it.

   Generate a JWT secret in PowerShell:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. Apply migrations and role seeds:

   ```powershell
   npm --prefix backend run db:setup
   ```

6. Create the initial System Administrator account once. Use a unique password of 12–72 UTF-8 bytes:

   ```powershell
   $env:BOOTSTRAP_ADMIN_EMAIL = "admin@example.edu"
   $env:BOOTSTRAP_ADMIN_NAME = "System Administrator"
   $env:BOOTSTRAP_ADMIN_PASSWORD = "replace-with-a-unique-password"
   npm --prefix backend run db:bootstrap-admin
   Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_NAME, Env:BOOTSTRAP_ADMIN_PASSWORD
   ```

   The command refuses to run if a System Administrator already exists.

7. Start the frontend and backend:

   ```powershell
   .\scripts\start-development.ps1
   ```

   Or run `npm run dev`. The frontend is at `http://localhost:5173`, the API at `http://localhost:3000`, and database readiness at `http://localhost:3000/ready`.

### Seed local demo users

For role-by-role UI testing only, seed one sample account for each of the five roles plus a demo department, student profile, sample group, pending proposal, and (when the database has no academic year yet) a demo calendar. This command is opt-in, refuses to run in production, and resets only the documented `*.example.test` demo accounts:

```powershell
$env:DEMO_SEED_ENABLED = "true"
$env:DEMO_SEED_PASSWORD = "Choose-a-local-demo-password"
npm --prefix backend run db:seed:demo
Remove-Item Env:DEMO_SEED_ENABLED, Env:DEMO_SEED_PASSWORD
```

All five sample users use the password supplied in `DEMO_SEED_PASSWORD` (8–72 UTF-8 bytes; development-only). The sample accounts are `admin.demo@example.test`, `head.demo@example.test`, `advisor.demo@example.test`, `examiner.demo@example.test`, and `student.demo@example.test`.

## Start the AI service

The setup script creates `ai-service\.venv`. Install its dependencies if you did not use `-InstallAiDependencies`, then start FastAPI in a separate terminal:

```powershell
Set-Location ai-service
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/health`. To enable sentence-embedding analysis, set `AI_SERVICE_TOKEN` in the AI service process to the same private token configured for the backend. The first similarity request loads `AI_EMBEDDING_MODEL` (defaults to `sentence-transformers/all-MiniLM-L6-v2`); that model must be available locally or downloaded. If the embedding runtime or model cannot load while AI is enabled, the service returns HTTP 503 rather than silently presenting lexical results as semantic AI. If no token is configured in the backend, project recommendations and title comparisons use the clearly labeled local TF-IDF lexical baseline instead.

## Start Redis and Celery on Windows

Install Redis in WSL2 Ubuntu and start it:

```powershell
wsl -d Ubuntu
```

Then in Ubuntu:

```bash
sudo apt update
sudo apt install -y redis-server python3-venv python3-pip
sudo service redis-server start
redis-cli ping
```

`redis-cli ping` should return `PONG`. Run Celery from the project in WSL2/Linux, using a Linux virtual environment:

```bash
cd /mnt/c/Codes/AI-GPMS/ai-service
python3 -m venv .venv-wsl
source .venv-wsl/bin/activate
python -m pip install -r requirements.txt
export REDIS_URL=redis://127.0.0.1:6379/0
celery -A app.celery_app:celery_app worker --loglevel=info
```

Redis and Celery currently support the health-check task. The current project similarity endpoint runs synchronously; long-running document and reporting tasks can use Celery in a later phase.

## Linux setup

From the repository root:

```bash
bash scripts/setup-linux.sh
```

Set the database values and JWT secret in `backend/.env`, start MySQL and Redis, then run `npm --prefix backend run db:setup`, bootstrap the administrator, and run `npm run dev`. To install the Python AI dependencies during setup, use:

```bash
INSTALL_AI_DEPENDENCIES=1 bash scripts/setup-linux.sh
```

Run FastAPI with the AI virtual environment and Celery in a separate Linux terminal:

```bash
cd ai-service
source .venv/bin/activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Environment variables

`.env.example` is a template, not a credential file. Backend scripts load the optional `backend/.env`; values already supplied by the shell take precedence. `AI_SERVICE_URL` and `AI_SERVICE_TOKEN` enable the internal sentence-embedding service; leave the token blank to use the local TF-IDF baseline. The AI service process must receive the same token as the backend. `REDIS_URL` is used by Celery.

## Useful commands

```powershell
npm run dev
npm --prefix frontend run build
npm --prefix backend test
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
npm --prefix backend start
```

Run the AI service's focused tests from the activated AI-service environment:

```powershell
Set-Location ai-service
python -m unittest discover -s tests -v
```

## Existing API foundation

- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`
- `GET /api/auth/me`, `POST /api/auth/change-password`
- `POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/confirm`
- `/api/users`, `/api/departments`, and `/api/roles` (role-protected)
- `/api/academics/years` and `/api/academics/semesters` for academic calendar management
- `/api/students` for department-scoped student listing and individual student records
- `/api/students/imports/preview` and `/api/students/imports/:batchId/confirm` for validated, two-step imports
- `/api/students/rules/:departmentId`, `/api/students/eligibility`, and `/api/students/eligibility/evaluate`
- `POST /api/students/register` for Department Head student account and record creation
- `/api/students/groups` and `/api/students/groups/:groupId/members`
- `POST /api/students/:userId/graduate` and `POST /api/students/groups/:groupId/graduate` to graduate individual students or all current members of a group and revoke their login access; corresponding `/reinstate` routes restore active status and login access
- `/api/projects/mine` for student proposal submission and review status
- `/api/projects/submissions` and `/api/projects/submissions/:submissionId/review` for Head review
- `/api/projects/staff` for Department Head advisor/examiner account management; staff profiles require areas of interest, allow optional specialization, and advisor assignments have no active-group cap
- `/api/projects/advisors/assign-ai` and `/api/projects/groups/:groupId/advisor` for advisor recommendations and reassignment
- `/api/projects/similarity` for department-scoped project title/description comparisons
- `/api/projects/defenses` and `/api/projects/defenses/:scheduleId/examiners` for defense scheduling and examiner assignment
- `/api/projects/assessments` and `/api/projects/examiner/defenses/:scheduleId/assessment` for submitted examiner evaluations
- `/api/projects/reports` for department statistics and project progress
- `POST /api/v1/similarity` on the internal AI service for authenticated sentence-embedding comparisons
- `GET /health`, `GET /ready`

Student imports accept Excel workbooks up to 5 MB . The first worksheet must have `Student ID`, `Full Name`, and `Email` columns; `Program`, `Cohort`/`Batch`, `Year Level`, `GPA`, `Phone`, `Credits`, and `Department` are optional. A matching active student account must already exist for each email. Invalid rows are reported in the preview and the batch cannot be confirmed until a corrected file is uploaded.

Graduating a student marks their enrollment status as graduated, disables the account, and revokes refresh tokens. The matching reinstate action restores the pre-graduation account and academic statuses; students whose accounts were active can log in again and must sign in to create a new session. Group and project records are retained.

New student accounts must change their temporary password before using the system. Individual registration uses the initial password set by the Department Head. Excel imports generate a unique temporary password per new account and show the credentials once after confirmation; pass them privately to each student. Project title recommendations use the student's interests, application area, and tools and generate project titles only. Proposal submission immediately returns similarity comparisons with existing approved project work when available.

Students can message their assigned advisor and upload PDF/DOCX project documents. After an examiner requests revisions, students can upload defense corrections; an assigned examiner reviews the correction before submitting an outcome and an individual 0–100 grade for each group member. The Department Head assigns a chairperson from the active examiner panel. Students can view the defense date, venue, chairperson, and their own grade.

The student project workspace separates group details, project title recommendations, proposal submission, advisor chat, document uploads, and defense schedule into separate pages. A suggested title can be carried into the proposal form. Department Heads select one current group member as the leader while editing group membership. Students and assigned advisors can view the leader and all group members.

Only the five specified login roles exist: System Administrator, Department Head, Academic Advisor, Examiner, and Student. Academic policy values remain department-configurable. The transformer model's semantic-analysis quality depends on the configured model being available; the local baseline compares lexical overlap and must not be interpreted as a plagiarism decision.
