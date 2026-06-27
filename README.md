# BugMind AI

BugMind AI is a full-stack QA copilot for exploratory testing.

It takes a workflow description and observed steps, runs AI-driven analysis, and stores structured QA outputs (modules, checklist, test cases, issue analysis) in PostgreSQL so teams can continue work across sessions.

## What It Does

- Creates and manages testing projects
- Captures workspace context (workflow, observed steps, environment)
- Analyzes workflows using multi-agent reasoning
- Generates modules, checklist items, and manual test cases
- Supports issue classification from tester observations
- Persists analysis/test cases/issues/workspaces in PostgreSQL
- **Secure Authentication:** JWT-based user authentication, password hashing, and session management.
- **Profile Management:** Fully featured user profiles with avatar uploads, personal details (Job Title, Location, Bio), and soft-deletion capability.
- **Bring Your Own Key (BYOK):** Users can securely store and utilize their own AI provider keys (OpenAI, Anthropic, Gemini, DeepSeek, XAI).

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy
- **Database**: PostgreSQL
- **Migrations**: Alembic
- **AI orchestration**: LangGraph + agent modules
- **Image Processing**: Pillow (Avatar EXIF stripping and validation)

## High-Level Architecture

```text
React Frontend (Vite)
      |
      v
FastAPI Routes (/auth, /api/me, /api/projects)
      |
      v
Service Layer + Authentication Guards
      |
      v
SQLAlchemy Models + PostgreSQL
      |
      v
LangGraph Supervisor + Agents
```

## Repository Layout

```text
BugMind Ai/
├── main.py
├── graph.py
├── constants.py
├── requirements.txt
├── alembic.ini
├── agents/            # AI agent modules for graph flow
├── auth/              # JWT dependencies, hashing, security utilities
├── routes/            # API endpoints (auth, user, projects, analysis, etc.)
├── services/          # Business logic domain layer
├── schemas/           # Pydantic request/response contracts
├── database/          # Session management & SQLAlchemy ORM models
├── alembic/           # Database migration history
├── uploads/           # Static asset storage (e.g., user avatars)
└── frontend/          # React + Vite application
```

## Core Entities

- `User`: Global account handling authentication, avatars, and profile details.
- `UserAISettings`: Encrypted storage for a user's BYOK provider API keys.
- `Project`: Scoped to a User. Tracks name, description, status, `created_at`, `updated_at`.
- `Workspace`: workflow + observed test context
- `Analysis`: generated AI output
- `TestCase`: structured manual test cases
- `Issue`: classified bug/observation outputs

## Security Properties

- **Stateless Invalidation**: Password changes instantly invalidate all other active sessions via a `credentials_updated_at` JWT guard.
- **Soft Deletes**: User accounts are soft-deleted via `deleted_at`, preserving foreign key integrity across historical QA projects.
- **Safe Avatars**: Avatar uploads strictly validate MIME types and use Pillow to permanently strip potentially sensitive EXIF metadata (e.g. GPS coordinates).
- **Key Isolation**: AI provider keys belong exclusively to the user and are never logged or exposed in plain text to the client.

## Local Development

### 1) Database setup

Ensure you have a local PostgreSQL instance running. Configure your `.env` file in the root directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/bugmind
JWT_SECRET=your_jwt_secret_key_here
```

### 2) Backend

Create and activate a virtual environment, then install dependencies:

```bash
python -m venv .venv
.\.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

Run database migrations to initialize tables:
```bash
alembic upgrade head
```

Start the API server:
```bash
uvicorn main:app --reload
```

### 3) Frontend

In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

## Expected Workflow

1. Create an account and customize your profile/avatar.
2. Store your API keys in the Security tab (if BYOK is enabled).
3. Create/open a project.
4. Enter workflow and observed steps.
5. Run analysis and review modules/checklist/test cases.
6. Classify issues and track progress.
7. Re-open project later with persisted state.

## Author

Developed by Sujal.
