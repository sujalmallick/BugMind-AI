# import os
# import json
# from dotenv import load_dotenv
# from fastapi import FastAPI
# from pydantic import BaseModel, Field
# import google.generativeai as genai
# from typing import TypedDict

# from langgraph.graph import StateGraph, START, END

# load_dotenv()


# genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
# model = genai.GenerativeModel("gemini-2.5-flash")

# app = FastAPI()

# # Pydantic validation - defines what input the API accepts
# class WorkflowInput(BaseModel):
#     workflow: str = Field(
#         min_length=5,
#         description="Application workflow"
#     )
#     observed_steps: list[str] | None = None

    
# class WorkflowState(TypedDict):
#     workflow: str
#     modules: dict
#     checklist: str
#     test_cases: str

# # Reusable Gemini call function
# def call_gemini(prompt: str):
#     response = model.generate_content(prompt)
#     return response.text


# def module_node(state: WorkflowState): #create agents as nodes

#     return {
#         "modules":
#         identify_modules_agent(
#             state["workflow"]
#         )
#     }
# def checklist_node(state: WorkflowState):

#     return {
#         "checklist":
#         generate_checklist_agent(
#             state["workflow"]
#         )
#     }
# def test_case_node(state: WorkflowState):

#     return {
#         "test_cases":
#         generate_test_cases_agent(
#             state["workflow"]
#         )
#     }

# # CHECKLIST AGENT #"What should I test?"

# def generate_checklist_agent(workflow: str):

#     prompt = f"""
# You are a senior QA engineer specializing in exploratory testing.

# Application Workflow:
# {workflow}

# Tasks:
# 1. Identify all modules involved.
# 2. Determine the critical user journeys.
# 3. Generate functional test scenarios.
# 4. Generate negative test scenarios.
# 5. Generate important edge cases.
# 6. Highlight high-risk areas requiring extra attention.

# Return the response in the following format:

# MODULE: Authentication
# Functional:
# - [ ] ...

# Negative:
# - [ ] ...

# Edge Cases:
# - [ ] ...

# High Risk:
# - ...

# Use concise statements.
# Do not explain why the test cases are important.
# Keep the response under 30 checklist items.
# """

#     return call_gemini(prompt)


# @app.post("/generate-checklist")
# def generate_checklist(data: WorkflowInput):

#     return {
#         "checklist": generate_checklist_agent(data.workflow)
#     }


# #MODULE IDENTIFICATION AGENT #"What parts of the app should I focus on?"

# def identify_modules_agent(workflow: str):

#     prompt = f"""
# You are a Senior QA Architect.

# Analyze this workflow:

# {workflow}

# Tasks:

# 1. Identify modules based ONLY on the workflow.
# 2. Categorize them as:

#    * confirmed_modules: directly supported by the workflow
#    * assumed_modules: likely but unconfirmed
#    * unknown_areas: cannot be inferred
# 3. Identify critical user journeys.
# 4. Identify high-risk areas requiring extensive testing.
# 5. Avoid unsupported assumptions. If information is insufficient, acknowledge it.

# Return ONLY valid JSON:

# {{
# "confirmed_modules": [],
# "assumed_modules": [],
# "unknown_areas": [],
# "critical_workflows": [],
# "high_risk_areas": []
# }}

# Rules:

# * No markdown.
# * No explanations outside JSON.
# * Prefer accuracy over completeness.
#   """


#     response = call_gemini(prompt)

#     try:
#         # Clean markdown wrappers if Gemini adds them
#         cleaned_response = (
#             response
#             .replace("```json", "")
#             .replace("```", "")
#             .strip()
#         )

#         return json.loads(cleaned_response)

#     except Exception:
#         return {
#             "raw_response": response
#         }


# @app.post("/identify-modules")
# def identify_modules(data: WorkflowInput):

#     return identify_modules_agent(data.workflow)


# #TEST CASE GENERATION AGENT "Help me document the tests."

# def generate_test_cases_agent(workflow: str):

#     prompt = f"""
# You are an experienced QA Engineer.

# Application Workflow:
# {workflow}

# Generate execution-ready manual test cases.

# For each test case, use EXACTLY the following format:

# Test Case ID:
# Test Description:
# Test Objective:
# Preconditions:
# Test Steps:
# Input Data:
# Expected Results:
# Actual Results:
# Test Environment:
# Test Execution Status:
# Priority:
# Attachments:
# Test Case Author:
# Test Case Reviewer:
# Notes:
# Developer Remarks:
# Solved:

# Requirements:
# - Generate functional, negative, and edge case scenarios.
# - Prioritize important user journeys first.
# - Leave the following fields blank:
#     Actual Results
#     Test Environment
#     Test Execution Status
#     Attachments
#     Test Case Author
#     Test Case Reviewer
#     Notes
#     Developer Remarks
#     Solved
# - Use concise language.
# - Keep steps clear and actionable.
# - Generate between 5 and 15 test cases.
# """

#     return call_gemini(prompt)

# @app.post("/generate-test-cases")
# def generate_test_cases(data: WorkflowInput):

#     return {
#         "test_cases": generate_test_cases_agent(data.workflow)
#     }


# #SUPERVISOR ENDPOINT
# @app.post("/analyze-workflow")
# def analyze_workflow(data: WorkflowInput):

#     result = workflow_graph.invoke(
#         {
#             "workflow": data.workflow
#         }
#     )

#     return result

# graph_builder = StateGraph(WorkflowState) #build the graph
    
# graph_builder.add_node( #add nodes to the graph
#     "module_agent",
#     module_node
# )

# graph_builder.add_node(
#     "checklist_agent",
#     checklist_node
# )

# graph_builder.add_node(
#     "test_case_agent",
#     test_case_node
# )

# graph_builder.add_edge( #connect the nodes in the graph using edges
#     START,
#     "module_agent"
# )

# graph_builder.add_edge(
#     "module_agent",
#     "checklist_agent"
# )

# graph_builder.add_edge(
#     "checklist_agent",
#     "test_case_agent"
# )

# graph_builder.add_edge(
#     "test_case_agent",
#     END
# )

# workflow_graph = graph_builder.compile() #compile