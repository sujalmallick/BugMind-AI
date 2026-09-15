# BugMind AI

BugMind AI is a full-stack QA workspace designed for exploratory testing, test case management, and issue tracking. It combines an interactive spreadsheet grid powered by AG Grid with an **orchestrated multi-agent workflow (LangGraph)** to help QA engineers and developers plan, execute, and track software testing cycles across teams.

---

## Core Capabilities

- **Interactive Issue Spreadsheet**: High-performance grid with inline cell editing, bulk Excel/CSV import (`.xlsx`, `.csv`), dynamic custom columns, dark hover tooltips, and isolated per-project column management (rename/remove/restore).
- **Orchestrated Multi-Agent Workflow**: A deterministic, prompt-chaining state machine powered by **LangGraph** where specialized persona nodes (`Module Agent` $\rightarrow$ `Checklist Agent` $\rightarrow$ `Test Case Agent`) sequentially analyze workflows, map critical user journeys, identify risk boundaries, and generate execution-ready manual test cases with error circuit-breaking.
- **AI Bug Classifier**: Convert raw tester observations into structured bug tickets with recommended severity, priority, and markdown outputs.
- **Organizations & Access Control**: Multi-tenant organizations with team-based project isolation and Role-Based Access Control (Owner, Admin, Editor, Viewer).
- **Real-Time Activity & Notifications**: Live notification drawer streamed via Server-Sent Events (SSE), granular audit feeds, and team analytics dashboards.
- **Security & BYOK**: JWT session management with instant revocation guards, password hashing, avatar EXIF metadata stripping, and encrypted user storage for custom AI provider keys (Google Gemini, OpenAI, Anthropic, DeepSeek, xAI).

---

## Tech Stack

| Layer | Stack |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, AG Grid Community, Lucide Icons, Axios, React Router |
| **Backend** | FastAPI, Python 3.11+, SQLAlchemy 2.0, Pydantic v2, Uvicorn, SlowAPI, Pillow |
| **Database** | PostgreSQL, Alembic |
| **Authentication** | JWT (python-jose), Passlib (bcrypt), RBAC dependencies |
| **AI Orchestration** | LangGraph (StateGraph Orchestrator), Multi-Provider LiteLLM Adapter, LangChain |

---

## Quickstart

### Prerequisites

- **Python**: 3.11+
- **Node.js**: 18+
- **PostgreSQL**: 14+

---

### 1. Backend Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sujalmallick/BugMind-AI.git
   cd BugMind-AI
   ```

2. **Virtual environment & dependencies**:
   ```bash
   # Windows
   python -m venv .venv
   .\.venv\Scripts\activate

   # macOS / Linux
   python3 -m venv .venv
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the project root:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/bugmind
   JWT_SECRET=your_secure_random_jwt_secret
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   ```

4. **Run database migrations & start server**:
   ```bash
   alembic upgrade head
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   API runs at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

---

### 2. Frontend Setup

1. **Install dependencies & start development server**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Application opens at `http://localhost:5173`.
