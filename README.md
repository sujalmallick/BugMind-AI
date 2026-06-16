# TestPilot AI

TestPilot AI is a **LangGraph-powered AI QA copilot** designed to assist manual testers during exploratory testing.

Given an application workflow, TestPilot AI identifies probable functional modules, highlights high-risk areas, generates exploratory testing checklists, and produces execution-ready manual test cases aligned with QA documentation practices.

---

## Problem Statement

During manual testing, testers often need to:

* Understand the scope of testing from incomplete information.
* Think of functional, negative, and edge-case scenarios.
* Document structured test cases in spreadsheets.
* Identify high-risk areas requiring additional attention.

This process is time-consuming and heavily dependent on individual experience.

TestPilot AI aims to **augment manual testers** by accelerating exploratory testing activities and generating structured QA artifacts from application workflows.

---

## Features

* Multi-agent architecture using **LangGraph**
* Workflow-based module identification
* Exploratory testing checklist generation
* High-risk area identification
* Manual test case generation
* Support for **observed user steps**
* FastAPI-based REST APIs
* Gemini-powered reasoning engine
* Modular and extensible project structure

---

## Architecture

```text
User Workflow
      ↓
FastAPI Backend
      ↓
LangGraph Supervisor
      ↓
┌─────────────────────────┐
│ Module Agent            │
├─────────────────────────┤
│ Checklist Agent         │
├─────────────────────────┤
│ Test Case Agent         │
└─────────────────────────┘
      ↓
Google Gemini API
```

---

## Tech Stack

* Python
* FastAPI
* LangGraph
* Google Gemini API
* Pydantic
* Uvicorn
* Python Dotenv

---

## Project Structure

```text
TestPilot AI/
│
├── agents/
│   ├── checklist_agent.py
│   ├── module_agent.py
│   └── testcase_agent.py
│
├── graph.py
├── main.py
├── models.py
├── utils.py
├── requirements.txt
├── .gitignore
└── .env
```

---

## API Endpoints

### Generate Exploratory Checklist

```http
POST /generate-checklist
```

---

### Identify Modules

```http
POST /identify-modules
```

---

### Generate Manual Test Cases

```http
POST /generate-test-cases
```

---

### Analyze Workflow (LangGraph Supervisor)

```http
POST /analyze-workflow
```

---

## Example Request

```json
{
    "workflow": "Login → Dashboard → Messages",
    "observed_steps": [
        "Open app",
        "Tap Login",
        "Enter email",
        "Enter password",
        "Tap Sign In"
    ]
}
```

---

## Running Locally

### Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/TestPilot-AI.git
```

### Navigate to the Project Directory

```bash
cd TestPilot-AI
```

### Create a Virtual Environment

```bash
python -m venv .venv
```

### Activate the Virtual Environment

#### Windows

```bash
.venv\Scripts\activate
```

#### Linux / macOS

```bash
source .venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Create a `.env` File

```env
GEMINI_API_KEY=your_api_key_here
```

### Run the Application

```bash
uvicorn main:app --reload
```

---

## Limitations

* Functional modules are **inferred from the provided workflow** and may not represent the complete application architecture.
* Generated execution steps may contain assumptions if observed user steps are not provided.
* Output quality depends on the completeness and accuracy of the supplied workflow.
* Gemini API usage is subject to rate limits and quota restrictions.

---

## Future Enhancements

* CSV export for direct Google Sheets integration
* Requirement document ingestion
* APK-assisted workflow extraction
* Additional QA agents for bug report generation
* Support for multiple LLM providers (OpenAI, Ollama, etc.)
* Persistent storage of generated QA artifacts

---

## Disclaimer

TestPilot AI is designed to **assist manual testers**, not replace them. Human validation remains essential to ensure complete test coverage and domain-specific accuracy.

---

## Author

Developed by **Sujal** as part of exploring the intersection of **Software Testing, LLMs, and Agentic AI**.
