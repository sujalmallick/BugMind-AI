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

## Tech Stack

- Frontend: React + Vite
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL
- Migrations: Alembic
- AI orchestration: LangGraph + agent modules

## High-Level Architecture

```text
React Frontend
      |
      v
FastAPI Routes
      |
      v
Service Layer
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
├── agents/
├── routes/
├── services/
├── schemas/
├── database/
├── alembic/
└── frontend/
```

## Backend Structure

- `routes/`: API endpoints (`project`, `workspace`, `analysis`, `test_case`, `issue`)
- `services/`: business logic for each domain
- `schemas/`: Pydantic request/response contracts
- `database/models/`: SQLAlchemy ORM models
- `agents/`: AI agents used by graph flow
- `alembic/versions/`: DB migration history

## Frontend Structure

- `frontend/src/pages/`: `ProjectsPage`, `WorkspacePage`
- `frontend/src/components/`: layout, tabs, project cards, shared UI
- `frontend/src/services/`: API clients for backend routes
- `frontend/src/hooks/`: project/workspace state hooks
- `frontend/src/utils/`: shared utilities (time formatting, exports)

## Core Entities

- `Project`: name, description, status, `created_at`, `updated_at`
- `Workspace`: workflow + observed test context
- `Analysis`: generated AI output
- `TestCase`: structured manual test cases
- `Issue`: classified bug/observation outputs

## Project Timestamp Behavior

Project timestamps are persisted in PostgreSQL and returned by backend APIs.

- `updated_at` changes whenever a project is updated/touched
- Frontend maps API fields to camelCase (`updated_at` -> `updatedAt`)
- Relative time labels in project cards/header are computed in UI

Important:
- Backend datetime values may arrive as UTC strings without explicit timezone suffix.
- Frontend timestamp parsing normalizes these values as UTC before computing relative time, preventing fixed offset bugs (for example, always showing `5-6 hours ago`).

## Local Development

### 1) Backend

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Run API server:

```bash
uvicorn main:app --reload
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3) Database Migrations

```bash
alembic upgrade head
```

## Expected Workflow

1. Create/open a project
2. Enter workflow and observed steps
3. Run analysis
4. Review modules/checklist/test cases
5. Classify issues and track progress
6. Re-open project later with persisted state

## Notes

- AI output quality depends on workflow clarity and detail.
- Manual validation is still required for final QA sign-off.

## Author

Developed by Sujal.
