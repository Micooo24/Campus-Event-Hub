# Student Org Event Desk

## Introduction

Student Org Event Desk is a lightweight MVP web application designed for student organizations to plan, manage, and track events from a single hub. It provides event CRUD operations, a visual weekly scheduler, an interactive flowchart-based execution planner, attendance reporting, and an AI-powered FAQ chatbot. The frontend is built with React 19 and TypeScript, bundled by Vite, while the backend runs on FastAPI with in-memory storage.

## Tech Stack

| Layer     | Technology                  | Version   |
|-----------|-----------------------------|-----------|
| Framework | React                       | 19.2.6    |
| Language  | TypeScript                  | 6.0.2     |
| Bundler   | Vite                        | 8.0.12    |
| Flowchart | @xyflow/react (React Flow)  | 12.10.2   |
| Styling   | Custom CSS with CSS variables | -       |
| Fonts     | Space Grotesk, Fraunces     | Google Fonts |
| Backend   | FastAPI + Uvicorn           | 0.115.0   |
| AI        | Google Gemini 2.5 Flash     | Optional  |

## Project Structure

```
Hackathon Project/
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # App entry point (StrictMode + ReactDOM)
│   │   ├── App.tsx               # All components, state, and logic
│   │   ├── App.css               # Component and layout styles
│   │   ├── index.css             # Theme variables, fonts, global resets
│   │   └── assets/
│   │       ├── hero.png
│   │       ├── react.svg
│   │       └── vite.svg
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   └── tsconfig.node.json
├── backend/
│   ├── main.py                   # FastAPI server (all endpoints)
│   ├── requirements.txt
│   ├── .env                      # Gemini API key (gitignored)
│   └── .gitignore
└── README.md
```

The frontend is a single-page application with all UI logic in `App.tsx`. There is no routing library; views are toggled via React state (selected event, modal open/close, etc.).

## Design System

### Theme Variables (index.css)

| Variable         | Value           | Purpose                        |
|------------------|-----------------|--------------------------------|
| `--text`         | `#1f2933`       | Primary text color             |
| `--text-muted`   | `#5b6775`       | Secondary/muted text           |
| `--bg`           | `#f8f6f1`       | Page background                |
| `--panel`        | `#ffffff`       | Panel/card background          |
| `--card`         | `#fdfcf9`       | Nested card background         |
| `--border`       | `#e7e1d8`       | Border color throughout        |
| `--accent`       | `#0f8a7a`       | Primary action color (teal)    |
| `--chip`         | `#f0ebe2`       | Chip/badge background          |
| `--danger`       | `#c43d2d`       | Destructive action color       |
| `--shadow-soft`  | Subtle shadow   | Cards and panels               |
| `--shadow-strong`| Deeper shadow   | Modals and active selections   |

### Typography

- **Headings**: Fraunces (serif), weight 500-700
- **Body/UI**: Space Grotesk (sans-serif), weight 400-700
- **Code**: SFMono-Regular / Consolas (monospace)
- **Base size**: 16px (15px on screens <= 1024px)

### Layout

- Max content width: `1200px` (centered)
- Two-column grid layout: left panel (event management) + right panel (event detail)
- Responsive breakpoint at `1024px` collapses to single column
- Padding: `40px 48px` desktop, `28px 20px` mobile

## Features

### 1. Event CRUD

Full create, read, update, and delete operations for events.

- **Create**: Fill the form (title, date/time, location, capacity, description) and submit
- **Update**: Click "Edit" on any event card, modify fields, click "Update event"
- **Delete**: Click "Delete" on any event card (removes associated plans, edges, and registrations)
- **Select**: Click event cards in the list or timeline to view details

**Data model:**
```typescript
type EventItem = {
  id: number
  title: string
  date: string            // Format: "YYYY-MM-DD HH:MM"
  location: string
  capacity: number
  registeredCount: number
  description: string
}
```

### 2. Weekly Scheduler

A grid-based calendar view mapping events to day/hour slots.

- **Grid**: 7 columns (Mon-Sun) x 4 time rows (09:00, 12:00, 15:00, 18:00)
- **Slot mapping**: Events snap to the nearest hour slot via `getScheduleSlot()`
- **Month filter**: Dropdown filters events by `YYYY-MM` key
- **"Current month" button**: Quick jump to the current month
- **Timeline list**: Sorted chronological list of events below the grid
- **Event chips**: Color-coded; active event highlighted in teal with `+N` overflow badge

### 3. Interactive Flowchart Planner (React Flow)

A visual canvas for mapping event execution flow with draggable nodes and connectable edges.

- **Draggable nodes**: Each plan step renders as a styled card node with label, owner, and status
- **Connections**: Drag from the bottom handle of one node to the top handle of another to create animated arrows
- **Color-coded status**: Nodes are tinted by status (gray = todo, teal = in-progress, green = done)
- **Edit/Delete on nodes**: Buttons directly on each node card
- **Position persistence**: Node positions save to the backend on drag stop
- **Canvas controls**: Zoom, pan, fit-to-view, and a minimap for navigation
- **Sidebar form**: Add or edit steps from the right panel without leaving the canvas
- **Legend**: Visual guide showing status colors
- **Stats**: Live count of steps and connections

**Data models:**
```typescript
type PlanStep = {
  id: string
  label: string
  owner: string
  status: 'todo' | 'in-progress' | 'done'
  position_x: number
  position_y: number
}

type PlanEdge = {
  id: string
  source: string      // PlanStep id
  target: string      // PlanStep id
}
```

**Custom node component (`StepNode`):**
- Top handle (target) for incoming connections
- Bottom handle (source) for outgoing connections
- Dynamic border/background color based on status
- Inline edit and delete buttons

### 4. Execution Flow Preview

A read-only ordered list in the event detail panel showing:
- Numbered index badges
- Step label and owner
- Status pill (color-coded)

This provides a quick glance without opening the full planner.

### 5. Attendance and Reporting

- **Registration**: Backend supports attendee registration with email (mocked confirmation emails)
- **Attendance**: Mark attendance via email
- **Report panel**: Shows registered count, attended count, and attendance rate percentage

### 6. FAQ Chatbot

AI-powered project assistant using Google Gemini 2.5 Flash.

- **Predefined questions**: 6 FAQ chips for common queries
- **Custom input**: Free-text question field
- **Chat history**: Scrollable message thread with user/assistant bubbles
- **Reset**: Clear conversation and start over
- **Fallback**: Returns error if Gemini API key is not configured

## State Management

All state is managed via React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`). No external state library is used.

### Key State Variables

| State Variable     | Type                          | Purpose                              |
|--------------------|-------------------------------|--------------------------------------|
| `events`           | `EventItem[]`                 | All events from the API              |
| `selectedEventId`  | `number \| null`              | Currently selected event             |
| `eventDraft`       | Object                        | Form state for event create/edit     |
| `plansByEvent`     | `Record<number, PlanStep[]>`  | Cached plan steps per event          |
| `edgesByEvent`     | `Record<number, PlanEdge[]>`  | Cached edges per event               |
| `planDraft`        | Object                        | Form state for step create/edit      |
| `isPlanOpen`       | `boolean`                     | Flow planner modal visibility        |
| `selectedMonth`    | `string`                      | Month filter (`'all'` or `YYYY-MM`)  |
| `chatMessages`     | `ChatMessage[]`               | Chat conversation history            |
| `rfNodes`          | `Node[]`                      | React Flow node state                |
| `rfEdges`          | `Edge[]`                      | React Flow edge state                |

## API Endpoints

Base URL: `http://localhost:8000` (configurable via `VITE_API_BASE` env var)

### Events

| Method   | Endpoint                  | Description              |
|----------|---------------------------|--------------------------|
| `GET`    | `/events`                 | List all events          |
| `POST`   | `/events`                 | Create a new event       |
| `GET`    | `/events/{id}`            | Get event by ID          |
| `PUT`    | `/events/{id}`            | Update event             |
| `DELETE` | `/events/{id}`            | Delete event and cleanup |

### Event Plans

| Method   | Endpoint                                    | Description                    |
|----------|---------------------------------------------|--------------------------------|
| `GET`    | `/events/{id}/plan`                         | Get all steps and edges        |
| `POST`   | `/events/{id}/plan/steps`                   | Add a new step                 |
| `PUT`    | `/events/{id}/plan/steps/{step_id}`         | Update step details            |
| `DELETE` | `/events/{id}/plan/steps/{step_id}`         | Delete step (cleans up edges)  |
| `PUT`    | `/events/{id}/plan/steps/{step_id}/position`| Update node position (x, y)   |

### Plan Edges

| Method   | Endpoint                                | Description                |
|----------|-----------------------------------------|----------------------------|
| `POST`   | `/events/{id}/plan/edges`               | Create a connection        |
| `DELETE` | `/events/{id}/plan/edges/{edge_id}`     | Remove a connection        |

### Registration and Attendance

| Method   | Endpoint                          | Description               |
|----------|-----------------------------------|---------------------------|
| `POST`   | `/events/{id}/register`           | Register an attendee      |
| `POST`   | `/events/{id}/attendance`         | Mark attendance by email  |
| `GET`    | `/events/{id}/report`             | Get attendance report     |

### Chat

| Method   | Endpoint   | Body                         | Description           |
|----------|------------|------------------------------|-----------------------|
| `POST`   | `/chat`    | `{ "message": "question" }` | Query the FAQ chatbot |

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt

# Optional: configure Gemini for the chatbot
# Create backend/.env with:
# GOOGLE_API_KEY=your_key_here

uvicorn main:app --reload
```

The API server starts at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

### Environment Variables

| Variable         | File            | Required | Description                           |
|------------------|-----------------|----------|---------------------------------------|
| `GOOGLE_API_KEY` | `backend/.env`  | No       | Gemini API key for chatbot            |
| `VITE_API_BASE`  | Frontend env    | No       | Backend URL (default: localhost:8000) |

## Build

```bash
cd frontend
npm run build
```

Output goes to `frontend/dist/`. The build runs TypeScript checking (`tsc -b`) then Vite production bundling.

## Limitations

- No authentication or authorization
- In-memory storage only (all data resets on backend restart)
- Single-file frontend architecture (all components in App.tsx)
- No unit or integration tests
- Chatbot depends on Gemini API key availability
- CORS is restricted to localhost:5173 and 127.0.0.1:5173

## Future Considerations

- Persistent storage (PostgreSQL or SQLite) instead of in-memory data
- Component decomposition (break App.tsx into smaller modules)
- Drag-and-drop scheduling for the week view
- Real-time collaboration via WebSockets
- User authentication and role-based access
- Export flowcharts as images or PDFs
- Mobile-responsive improvements for the flow canvas
