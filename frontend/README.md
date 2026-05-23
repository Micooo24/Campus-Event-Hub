# Student Org Event Desk

## Introduction
Student Org Event Desk is a lightweight MVP for event planning. It focuses on
creating and organizing events, outlining execution plans with roles, and
keeping a clear schedule view for upcoming activities. The UI is built with
React and Vite, while the backend uses FastAPI for in-memory event management
and optional Gemini-powered FAQ responses.

## Project Structure
- frontend: React + TypeScript UI
- backend: FastAPI API server with in-memory storage

## Features
- Event CRUD for creating, updating, and deleting events.
- Scheduler with a weekly grid and month filter for quick scanning.
- Event planning flow with steps, assignees, and status tracking.
- Project FAQ chatbot with predefined questions and optional Gemini answers.
- Attendance reporting data still available in backend (UI can hide it).

## Architecture Overview
- Frontend fetches events and plans from the backend API.
- All event data is stored in memory on the backend.
- The FAQ chatbot can call a backend /chat endpoint (Gemini 2.5 Flash).
- No auth or persistence (intended for MVP demos).

## Setup
### Backend
1) Create and activate a Python virtual environment.
2) Install dependencies:
	pip install -r backend/requirements.txt
3) Configure the Gemini key (optional):
	backend/.env
	GOOGLE_API_KEY=your_key_here
4) Start the API server:
	uvicorn main:app --reload

### Frontend
1) Install dependencies:
	npm install
2) Start the dev server:
	npm run dev

## Usage
### Event CRUD
- Create: Fill the Event CRUD form and click Create event.
- Update: Click Edit on an event card, then update fields and click Update event.
- Delete: Click Delete on an event card.

### Scheduler
- Use the Month filter to show events for a specific month.
- Click Current month to jump to the current month.
- The week grid shows the closest hour slot for each event.

### Planning Flow
- Use Plan steps in the scheduler panel to add steps and assignees.
- Status options: todo, in-progress, done.
- Use the Plan button in the detail panel for the full planner modal.

### FAQ Chatbot
- Use the question chips to ask common questions.
- Type a custom question and click Send to query the backend /chat endpoint.
- If Gemini is not configured, the backend returns an error.

## API Overview (Backend)
Base URL: http://localhost:8000

### Events
- GET /events
- POST /events
- GET /events/{event_id}
- PUT /events/{event_id}
- DELETE /events/{event_id}

### Event Plans
- GET /events/{event_id}/plan
- POST /events/{event_id}/plan/steps
- PUT /events/{event_id}/plan/steps/{step_id}
- DELETE /events/{event_id}/plan/steps/{step_id}

### Attendance and Reports
- POST /events/{event_id}/attendance
- GET /events/{event_id}/report

### Chat
- POST /chat
  Body: { "message": "your question" }

## Data Model Notes
- Event: id, title, date, location, capacity, registeredCount, description
- PlanStep: id, label, owner, status
- In-memory storage resets on backend restart

## Limitations
- No authentication or authorization
- In-memory storage only (no database)
- Scheduler is static (no drag-and-drop yet)
- Chatbot depends on Gemini API key availability

## Future Implementation
- Drag-and-drop scheduling for the week view
- Persistent storage (database) instead of in-memory data
- Real-time collaboration for event planning
- Enhanced analytics and reporting for event outcomes
