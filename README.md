# BugMind AI

BugMind AI is a full-stack QA workspace and test management system designed for exploratory testing, test case tracking, and issue management. It combines an interactive spreadsheet grid for issue tracking with multi-agent workflow analysis to help QA engineers and developers plan, execute, and track software testing cycles.

---

## Key Features

### 1. Interactive Issues & Bug Spreadsheet
- **High-Performance Grid**: Powered by AG Grid with inline cell editing, quick search filtering, CSV export, and auto-save on blur.
- **Excel & CSV Bulk Import**: Upload `.xlsx` or `.csv` test logs with flexible column mapping to populate issues or test cases in seconds.
- **Custom Columns**: Add, rename, and remove custom fields on the fly. Extra attributes are persisted as structured JSON (`custom_fields`) in PostgreSQL.
- **Column Management**: Rename headers or remove unwanted columns with a confirmation dialog; restore hidden columns at any time.
- **Detailed Tooltips**: Dark floating tooltips on hover to inspect full text across truncated multi-line fields (e.g. reproduction steps, descriptions, expected/actual results).

### 2. Workflow Analysis & Test Case Generation
- **Workspace Context**: Document feature workflows, observed tester steps, and environment parameters (OS, build version, platform, device).
- **Module & Checklist Breakdown**: Structured breakdowns of application modules and verification checklists with progress checkboxes.
- **Test Case Management**: Create, view, and update manual test cases with preconditions, step-by-step actions, and execution statuses (`Passed`, `Failed`, `Blocked`, `Not Executed`).
- **AI Bug Classifier**: Convert raw tester observations into structured bug reports with suggested severity, priority, and markdown-formatted bug tickets.

### 3. Organizations, Teams & Access Control
- **Multi-Tenancy**: Organize projects under distinct organizations and assign them to specific functional teams.
- **Role-Based Access Control (RBAC)**: Enforced permission hierarchy (`Owner`, `Admin`, `Editor`, `Viewer`) guarding project mutations and administrative actions.
- **Member Invitations**: Invite team members via unique email invitation tokens.

### 4. Real-Time Activity & Notifications
- **Live Notification Drawer**: Real-time alerts streamed directly to the client via Server-Sent Events (SSE).
- **Audit Activity Log**: Track all critical project actions (test case creation, issue resolution, role updates) with an append-only activity feed.
- **Project & Team Dashboards**: Visual metrics tracking test case completion, issue resolution rates, and team workload distribution.

### 5. Security & BYOK (Bring Your Own Key)
- **Session Revocation**: Password updates trigger instant invalidation across all active sessions using a `credentials_updated_at` JWT timestamp guard.
- **Encrypted Provider Keys**: Users can securely save personal API keys for major LLM providers (Google Gemini, OpenAI, Anthropic, DeepSeek, xAI).
- **Avatar Sanitization**: Uploaded avatars are strictly MIME-validated and processed with Pillow to strip potentially sensitive EXIF metadata.
- **Soft Deletes**: Soft-deletion architecture preserves relational integrity across historical QA project records.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, AG Grid Community, Lucide React, Axios, React Router DOM |
| **Backend** | FastAPI, Python 3.11+, SQLAlchemy 2.0, Pydantic v2, Uvicorn, SlowAPI, Pillow |
| **Database** | PostgreSQL, Alembic (database migrations) |
| **Authentication** | JWT (python-jose), Passlib (bcrypt), RBAC dependencies |
| **AI Orchestration** | LangGraph, LangChain, Google Generative AI |

---

## Project Structure

```text
BugMind-Ai/
├── main.py                     # FastAPI application entry point and router registry
├── graph.py                    # LangGraph workflow orchestration
├── constants.py                # System constants and model definitions
├── requirements.txt            # Python dependencies
├── alembic.ini                 # Alembic migration configuration
├── agents/                     # LangGraph agent definitions (workflow analysis, issues)
├── auth/                       # JWT dependencies, password hashing, and RBAC guards
│   ├── dependencies.py
│   ├── jwt.py
│   ├── permissions.py
│   └── security.py
├── database/                   # SQLAlchemy engine, session maker, and ORM models
│   ├── base.py
│   ├── session.py
│   └── models/                 # User, Project, Workspace, TestCase, Issue, Org, etc.
├── routes/                     # API route controllers
│   ├── auth.py                 # User registration, login, token refresh
│   ├── user.py                 # Profile management and avatar uploads
│   ├── project.py              # Project CRUD and status management
│   ├── workspace.py            # Workspace context and checklist state
│   ├── test_case.py            # Test case creation, updates, execution
│   ├── issue.py                # Issues spreadsheet CRUD and bulk import
│   ├── organization.py         # Multi-tenant orgs and team memberships
│   ├── invitation.py           # Team invite token verification and acceptance
│   ├── notification.py         # Notifications and SSE streaming endpoint
│   ├── activity.py             # Activity log feed
│   └── dashboard.py            # Analytics and workload aggregation
├── schemas/                    # Pydantic request and response schemas
├── services/                   # Business logic and database operations
├── uploads/                    # User avatar storage
└── frontend/                   # React + Vite application
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── api/                # API client adapters
        ├── auth/               # AuthContext and ProtectedRoute
        ├── components/
        │   ├── common/         # Modals, buttons, dialogs
        │   ├── csv/            # CSV/Excel bulk import wizard
        │   ├── layout/         # Header, TabBar, NotificationsDrawer, Footer
        │   ├── projects/       # Project cards, creation modal, share modal
        │   ├── shared/         # EditableDataGrid (AG Grid), ToastStack
        │   ├── tabs/           # IssuesTrackerTab, TestCasesTab, ModulesTab, etc.
        │   └── workspace/      # Workflow inputs, AI analysis summary
        ├── pages/              # Top-level view routes (Projects, Workspace, Dashboard, etc.)
        └── services/           # Axios HTTP request services
```

---

## Getting Started

### Prerequisites

- **Python**: 3.11 or higher
- **Node.js**: 18.x or higher
- **PostgreSQL**: 14+ running locally or in a container

---

### 1. Backend Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sujalmallick/BugMind-AI.git
   cd BugMind-AI
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # Windows
   python -m venv .venv
   .\.venv\Scripts\activate

   # macOS / Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   Create a `.env` file in the project root:
   ```env
   # Database
   DATABASE_URL=postgresql://postgres:password@localhost:5432/bugmind

   # Authentication
   JWT_SECRET=replace_with_a_secure_random_string
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440

   # AI Provider Keys (Optional global default fallback)
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

5. **Run database migrations**:
   ```bash
   alembic upgrade head
   ```

6. **Start the backend server**:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   The API will be available at `http://localhost:8000`. Swagger documentation is accessible at `http://localhost:8000/docs`.

---

### 2. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install npm dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables** (optional):
   Create a `frontend/.env` file if connecting to a custom backend host:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. **Build for production**:
   ```bash
   npm run build
   ```

---

## Typical Workflow

1. **Sign Up & Profile**: Register an account and configure your BYOK provider key under your profile settings.
2. **Create or Open a Project**: Launch a new testing initiative or choose from your project dashboard.
3. **Workflow Specification**: Provide workflow descriptions and observed steps to run automated module and checklist generation.
4. **Excel / CSV Import**: Upload existing bug logs or test suites to populate the interactive spreadsheet tracker.
5. **Execute & Track**: Edit bug details directly in the grid, manage columns, update statuses, and log observations.
6. **Collaborate**: Invite team members to the organization, assign roles, and monitor progress on team dashboards.

---

## License

This project is licensed under the MIT License.
