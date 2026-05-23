from datetime import datetime
import json
import os
from typing import Dict, List, Literal, Set
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Student Org Event MVP", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

EVENTS: List[Dict] = [
    {
        "id": 1,
        "title": "Welcome Week Mixer",
        "date": "2026-08-25 18:00",
        "location": "Student Center Atrium",
        "capacity": 120,
        "registeredCount": 42,
        "description": "Kick off the year with music, snacks, and club intros.",
    },
    {
        "id": 2,
        "title": "Product Design Sprint",
        "date": "2026-09-03 15:00",
        "location": "Innovation Lab 2A",
        "capacity": 60,
        "registeredCount": 18,
        "description": "Rapid ideation and prototyping for campus problems.",
    },
    {
        "id": 3,
        "title": "Leadership Fireside",
        "date": "2026-09-10 19:00",
        "location": "Library Auditorium",
        "capacity": 200,
        "registeredCount": 95,
        "description": "Hear from alumni leaders and meet the exec board.",
    },
]

REGISTRATIONS: List[Dict] = []
ATTENDANCE: Dict[int, Set[str]] = {}
EVENT_PLANS: Dict[int, List[Dict]] = {}
EVENT_PLAN_EDGES: Dict[int, List[Dict]] = {}

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"

PROJECT_CONTEXT = """
You are the Student Org Event Desk assistant. Answer questions about this project.
Key features:
- Event CRUD (create/update/delete) with title, date/time, location, capacity, description.
- Registration flow with mocked confirmation emails.
- Attendance check-in and post-event reporting.
- Event plans with steps, assignees, and statuses (todo/in-progress/done).
- Scheduler view with week grid and month filter.
- Data is stored in memory on the backend (reset on restart).
Answer concisely and stay within this scope.
""".strip()


class RegistrationIn(BaseModel):
    name: str
    email: EmailStr


class AttendanceIn(BaseModel):
    email: EmailStr


class EventIn(BaseModel):
    title: str
    date: str
    location: str
    capacity: int
    description: str


class PlanStepIn(BaseModel):
    label: str
    owner: str
    status: Literal["todo", "in-progress", "done"]
    position_x: float = 0
    position_y: float = 0


class PlanStepOut(PlanStepIn):
    id: str


class PlanEdgeIn(BaseModel):
    source: str
    target: str


class PlanEdgeOut(PlanEdgeIn):
    id: str


class ChatIn(BaseModel):
    message: str


def find_event(event_id: int) -> Dict:
    for event in EVENTS:
        if event["id"] == event_id:
            return event
    raise HTTPException(status_code=404, detail="Event not found.")


def next_event_id() -> int:
    return max((event["id"] for event in EVENTS), default=0) + 1


def call_gemini(prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key not configured.")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    )
    payload = {
        "system_instruction": {"parts": [{"text": PROJECT_CONTEXT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 512},
    }
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        error_body = ""
        try:
            error_body = error.read().decode("utf-8")
        except Exception:
            error_body = ""
        detail = "Gemini request failed."
        if error_body:
            detail = f"Gemini request failed: {error_body}"
        raise HTTPException(status_code=502, detail=detail) from error
    except URLError as error:
        raise HTTPException(status_code=502, detail="Gemini network error.") from error

    candidates = data.get("candidates", [])
    if not candidates:
        return "I could not generate a response right now."
    content = candidates[0].get("content", {})
    parts = content.get("parts", [])
    if not parts:
        return "I could not generate a response right now."
    return parts[0].get("text", "I could not generate a response right now.")


@app.get("/events")
async def list_events() -> List[Dict]:
    return EVENTS


@app.post("/chat")
async def chat(payload: ChatIn) -> Dict:
    prompt = payload.message.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Message is required.")
    reply = call_gemini(prompt)
    return {"reply": reply}


@app.post("/events")
async def create_event(payload: EventIn) -> Dict:
    if payload.capacity <= 0:
        raise HTTPException(status_code=400, detail="Capacity must be positive.")

    event = {
        "id": next_event_id(),
        "title": payload.title.strip(),
        "date": payload.date.strip(),
        "location": payload.location.strip(),
        "capacity": payload.capacity,
        "registeredCount": 0,
        "description": payload.description.strip(),
    }
    EVENTS.append(event)
    return event


@app.get("/events/{event_id}")
async def get_event(event_id: int) -> Dict:
    return find_event(event_id)


@app.put("/events/{event_id}")
async def update_event(event_id: int, payload: EventIn) -> Dict:
    event = find_event(event_id)
    if payload.capacity <= 0:
        raise HTTPException(status_code=400, detail="Capacity must be positive.")
    if payload.capacity < event["registeredCount"]:
        raise HTTPException(
            status_code=400, detail="Capacity cannot be below registrations."
        )

    event.update(
        {
            "title": payload.title.strip(),
            "date": payload.date.strip(),
            "location": payload.location.strip(),
            "capacity": payload.capacity,
            "description": payload.description.strip(),
        }
    )
    return event


@app.delete("/events/{event_id}")
async def delete_event(event_id: int) -> Dict:
    event = find_event(event_id)
    EVENTS.remove(event)
    EVENT_PLANS.pop(event_id, None)
    EVENT_PLAN_EDGES.pop(event_id, None)
    ATTENDANCE.pop(event_id, None)
    REGISTRATIONS[:] = [
        registration
        for registration in REGISTRATIONS
        if registration.get("eventId") != event_id
    ]
    return {"message": "Event deleted.", "eventId": event_id}


@app.post("/events/{event_id}/register")
async def register_attendee(event_id: int, payload: RegistrationIn) -> Dict:
    event = find_event(event_id)

    if event["registeredCount"] >= event["capacity"]:
        raise HTTPException(status_code=400, detail="Event is full.")

    for registration in REGISTRATIONS:
        if registration["eventId"] == event_id and registration["email"] == payload.email:
            raise HTTPException(status_code=400, detail="Attendee already registered.")

    registration = {
        "id": len(REGISTRATIONS) + 1,
        "eventId": event_id,
        "name": payload.name,
        "email": payload.email,
        "timestamp": f"{datetime.utcnow().isoformat()}Z",
    }
    REGISTRATIONS.append(registration)
    event["registeredCount"] += 1

    print(
        f"[EMAIL MOCK] Confirmation sent to {payload.email} for event {event_id}"
    )

    return {
        "message": "Registration confirmed.",
        "event": event,
        "registration": registration,
    }


@app.post("/events/{event_id}/attendance")
async def mark_attendance(event_id: int, payload: AttendanceIn) -> Dict:
    find_event(event_id)
    attendees = ATTENDANCE.setdefault(event_id, set())
    attendees.add(payload.email)

    return {
        "message": "Attendance recorded.",
        "eventId": event_id,
        "attendedCount": len(attendees),
    }


@app.get("/events/{event_id}/report")
async def event_report(event_id: int) -> Dict:
    event = find_event(event_id)
    registered_count = event["registeredCount"]
    attended_count = len(ATTENDANCE.get(event_id, set()))
    attendance_rate = (attended_count / registered_count * 100) if registered_count else 0

    return {
        "eventId": event_id,
        "registeredCount": registered_count,
        "attendedCount": attended_count,
        "attendanceRate": attendance_rate,
    }


@app.get("/events/{event_id}/plan")
async def get_event_plan(event_id: int) -> Dict:
    find_event(event_id)
    return {
        "eventId": event_id,
        "steps": EVENT_PLANS.get(event_id, []),
        "edges": EVENT_PLAN_EDGES.get(event_id, []),
    }


@app.post("/events/{event_id}/plan/steps")
async def add_plan_step(event_id: int, payload: PlanStepIn) -> Dict:
    find_event(event_id)
    steps = EVENT_PLANS.setdefault(event_id, [])
    step = {
        "id": str(uuid4()),
        "label": payload.label.strip(),
        "owner": payload.owner.strip(),
        "status": payload.status,
        "position_x": payload.position_x,
        "position_y": payload.position_y,
    }
    steps.append(step)
    return {
        "eventId": event_id,
        "steps": steps,
        "edges": EVENT_PLAN_EDGES.get(event_id, []),
    }


@app.put("/events/{event_id}/plan/steps/{step_id}")
async def update_plan_step(event_id: int, step_id: str, payload: PlanStepIn) -> Dict:
    find_event(event_id)
    steps = EVENT_PLANS.setdefault(event_id, [])

    for step in steps:
        if step["id"] == step_id:
            step.update(
                {
                    "label": payload.label.strip(),
                    "owner": payload.owner.strip(),
                    "status": payload.status,
                    "position_x": payload.position_x,
                    "position_y": payload.position_y,
                }
            )
            return {
                "eventId": event_id,
                "steps": steps,
                "edges": EVENT_PLAN_EDGES.get(event_id, []),
            }

    raise HTTPException(status_code=404, detail="Plan step not found.")


@app.delete("/events/{event_id}/plan/steps/{step_id}")
async def delete_plan_step(event_id: int, step_id: str) -> Dict:
    find_event(event_id)
    steps = EVENT_PLANS.setdefault(event_id, [])
    next_steps = [step for step in steps if step["id"] != step_id]

    if len(next_steps) == len(steps):
        raise HTTPException(status_code=404, detail="Plan step not found.")

    EVENT_PLANS[event_id] = next_steps
    edges = EVENT_PLAN_EDGES.get(event_id, [])
    edges = [e for e in edges if e["source"] != step_id and e["target"] != step_id]
    EVENT_PLAN_EDGES[event_id] = edges
    return {"eventId": event_id, "steps": next_steps, "edges": edges}


@app.put("/events/{event_id}/plan/steps/{step_id}/position")
async def update_step_position(event_id: int, step_id: str, payload: Dict) -> Dict:
    find_event(event_id)
    steps = EVENT_PLANS.get(event_id, [])
    for step in steps:
        if step["id"] == step_id:
            step["position_x"] = payload.get("position_x", step.get("position_x", 0))
            step["position_y"] = payload.get("position_y", step.get("position_y", 0))
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Plan step not found.")


@app.post("/events/{event_id}/plan/edges")
async def add_plan_edge(event_id: int, payload: PlanEdgeIn) -> Dict:
    find_event(event_id)
    steps = EVENT_PLANS.get(event_id, [])
    step_ids = {s["id"] for s in steps}
    if payload.source not in step_ids or payload.target not in step_ids:
        raise HTTPException(status_code=400, detail="Invalid source or target step.")
    edges = EVENT_PLAN_EDGES.setdefault(event_id, [])
    for edge in edges:
        if edge["source"] == payload.source and edge["target"] == payload.target:
            return {
                "eventId": event_id,
                "steps": steps,
                "edges": edges,
            }
    edge = {
        "id": str(uuid4()),
        "source": payload.source,
        "target": payload.target,
    }
    edges.append(edge)
    return {"eventId": event_id, "steps": steps, "edges": edges}


@app.delete("/events/{event_id}/plan/edges/{edge_id}")
async def delete_plan_edge(event_id: int, edge_id: str) -> Dict:
    find_event(event_id)
    edges = EVENT_PLAN_EDGES.setdefault(event_id, [])
    next_edges = [e for e in edges if e["id"] != edge_id]
    if len(next_edges) == len(edges):
        raise HTTPException(status_code=404, detail="Edge not found.")
    EVENT_PLAN_EDGES[event_id] = next_edges
    return {
        "eventId": event_id,
        "steps": EVENT_PLANS.get(event_id, []),
        "edges": next_edges,
    }
