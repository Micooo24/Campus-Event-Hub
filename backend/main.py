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
        "title": "Hackathon 2026",
        "date": "2026-08-22 09:00",
        "location": "CS Building Lab 301",
        "capacity": 120,
        "registeredCount": 96,
        "description": "24-hour coding marathon where teams build MVPs to solve real-world problems using any tech stack.",
    },
    {
        "id": 2,
        "title": "TechTalks: AI & Cloud",
        "date": "2026-09-05 14:00",
        "location": "Auditorium B",
        "capacity": 200,
        "registeredCount": 142,
        "description": "Industry speakers share insights on AI engineering, cloud architecture, and DevOps careers.",
    },
    {
        "id": 3,
        "title": "Cybersecurity CTF",
        "date": "2026-09-12 10:00",
        "location": "Networking Lab 2F",
        "capacity": 80,
        "registeredCount": 64,
        "description": "Capture-the-flag competition covering web exploits, cryptography, and forensics challenges.",
    },
    {
        "id": 4,
        "title": "UI/UX Design Jam",
        "date": "2026-09-19 13:00",
        "location": "Multimedia Room 4A",
        "capacity": 60,
        "registeredCount": 38,
        "description": "Rapid design sprint where teams prototype mobile app interfaces and present to a panel of UX mentors.",
    },
    {
        "id": 5,
        "title": "DevOps Workshop Series",
        "date": "2026-10-03 15:00",
        "location": "Server Room Annex",
        "capacity": 40,
        "registeredCount": 28,
        "description": "Hands-on labs covering Docker, CI/CD pipelines, Kubernetes basics, and cloud deployment.",
    },
    {
        "id": 6,
        "title": "Tech Career Expo",
        "date": "2026-10-15 10:00",
        "location": "Main Hall Lobby",
        "capacity": 300,
        "registeredCount": 185,
        "description": "Connect with IT companies, attend resume reviews, and join mock technical interview booths.",
    },
]

REGISTRATIONS: List[Dict] = []
ATTENDANCE: Dict[int, Set[str]] = {}
EVENT_PLANS: Dict[int, List[Dict]] = {
    # 1 — Hackathon 2026
    1: [
        {"id": "hk-1", "label": "Define theme & rules", "owner": "Tech org president", "status": "done", "position_x": 280, "position_y": 0},
        {"id": "hk-2", "label": "Book lab & power strips", "owner": "Facilities officer", "status": "done", "position_x": 0, "position_y": 160},
        {"id": "hk-3", "label": "Recruit industry judges", "owner": "Industry liaison", "status": "done", "position_x": 280, "position_y": 160},
        {"id": "hk-4", "label": "Open team registration", "owner": "Membership head", "status": "done", "position_x": 560, "position_y": 160},
        {"id": "hk-5", "label": "Set up GitHub repos & Wi-Fi", "owner": "Infra lead", "status": "in-progress", "position_x": 0, "position_y": 320},
        {"id": "hk-6", "label": "Prepare food & energy packs", "owner": "Logistics head", "status": "in-progress", "position_x": 280, "position_y": 320},
        {"id": "hk-7", "label": "Mentor matching", "owner": "Academics officer", "status": "in-progress", "position_x": 560, "position_y": 320},
        {"id": "hk-8", "label": "Run 24-hr hacking sprint", "owner": "Event manager", "status": "todo", "position_x": 140, "position_y": 480},
        {"id": "hk-9", "label": "Demo day & awarding", "owner": "Judges panel", "status": "todo", "position_x": 420, "position_y": 480},
    ],
    # 2 — TechTalks: AI & Cloud
    2: [
        {"id": "tt-1", "label": "Invite speaker lineup", "owner": "VP external", "status": "done", "position_x": 250, "position_y": 0},
        {"id": "tt-2", "label": "Book auditorium & AV", "owner": "Logistics officer", "status": "done", "position_x": 0, "position_y": 160},
        {"id": "tt-3", "label": "Create event poster", "owner": "Creative director", "status": "done", "position_x": 500, "position_y": 160},
        {"id": "tt-4", "label": "Open RSVP form", "owner": "Membership head", "status": "done", "position_x": 250, "position_y": 160},
        {"id": "tt-5", "label": "Promote on socials & LMS", "owner": "Marketing head", "status": "in-progress", "position_x": 0, "position_y": 320},
        {"id": "tt-6", "label": "Prepare speaker kits", "owner": "VP external", "status": "in-progress", "position_x": 500, "position_y": 320},
        {"id": "tt-7", "label": "Dry run AV & livestream", "owner": "Tech team lead", "status": "todo", "position_x": 125, "position_y": 480},
        {"id": "tt-8", "label": "Host TechTalks event", "owner": "Emcee / moderator", "status": "todo", "position_x": 375, "position_y": 480},
    ],
    # 3 — Cybersecurity CTF
    3: [
        {"id": "ctf-1", "label": "Design CTF challenges", "owner": "Security club lead", "status": "done", "position_x": 250, "position_y": 0},
        {"id": "ctf-2", "label": "Set up CTFd platform", "owner": "Infra lead", "status": "done", "position_x": 0, "position_y": 160},
        {"id": "ctf-3", "label": "Recruit challenge testers", "owner": "QA volunteer", "status": "done", "position_x": 500, "position_y": 160},
        {"id": "ctf-4", "label": "Open player registration", "owner": "Membership head", "status": "in-progress", "position_x": 250, "position_y": 160},
        {"id": "ctf-5", "label": "Prepare scoring & hints", "owner": "Challenge authors", "status": "in-progress", "position_x": 0, "position_y": 320},
        {"id": "ctf-6", "label": "Configure network sandbox", "owner": "NetSec officer", "status": "in-progress", "position_x": 500, "position_y": 320},
        {"id": "ctf-7", "label": "Run competition day", "owner": "Event manager", "status": "todo", "position_x": 125, "position_y": 480},
        {"id": "ctf-8", "label": "Scoreboard reveal & prizes", "owner": "Security club lead", "status": "todo", "position_x": 375, "position_y": 480},
    ],
    # 4 — UI/UX Design Jam
    4: [
        {"id": "ux-1", "label": "Pick design brief & personas", "owner": "UX club president", "status": "done", "position_x": 280, "position_y": 0},
        {"id": "ux-2", "label": "Recruit UX mentors", "owner": "VP external", "status": "done", "position_x": 0, "position_y": 160},
        {"id": "ux-3", "label": "Set up Figma workspace", "owner": "Tech lead", "status": "done", "position_x": 560, "position_y": 160},
        {"id": "ux-4", "label": "Open team sign-ups", "owner": "Membership head", "status": "in-progress", "position_x": 0, "position_y": 320},
        {"id": "ux-5", "label": "Prepare evaluation rubric", "owner": "UX club president", "status": "in-progress", "position_x": 280, "position_y": 320},
        {"id": "ux-6", "label": "Print feedback forms", "owner": "Secretary", "status": "todo", "position_x": 560, "position_y": 320},
        {"id": "ux-7", "label": "Run design sprint day", "owner": "Facilitator", "status": "todo", "position_x": 140, "position_y": 480},
        {"id": "ux-8", "label": "Pitch showcase & critique", "owner": "Mentor panel", "status": "todo", "position_x": 420, "position_y": 480},
    ],
    # 5 — DevOps Workshop Series
    5: [
        {"id": "dw-1", "label": "Outline workshop curriculum", "owner": "DevOps lead", "status": "done", "position_x": 250, "position_y": 0},
        {"id": "dw-2", "label": "Provision cloud lab accounts", "owner": "Infra lead", "status": "done", "position_x": 0, "position_y": 160},
        {"id": "dw-3", "label": "Prepare Docker lab exercises", "owner": "Workshop instructor", "status": "done", "position_x": 500, "position_y": 160},
        {"id": "dw-4", "label": "Open attendee registration", "owner": "Membership head", "status": "in-progress", "position_x": 250, "position_y": 160},
        {"id": "dw-5", "label": "Set up CI/CD demo pipeline", "owner": "DevOps lead", "status": "in-progress", "position_x": 0, "position_y": 320},
        {"id": "dw-6", "label": "Create K8s sandbox cluster", "owner": "Infra lead", "status": "todo", "position_x": 500, "position_y": 320},
        {"id": "dw-7", "label": "Run hands-on sessions", "owner": "Workshop instructor", "status": "todo", "position_x": 125, "position_y": 480},
        {"id": "dw-8", "label": "Issue completion certificates", "owner": "Academics officer", "status": "todo", "position_x": 375, "position_y": 480},
    ],
    # 6 — Tech Career Expo
    6: [
        {"id": "ce-1", "label": "Reach out to tech companies", "owner": "Industry liaison", "status": "done", "position_x": 280, "position_y": 0},
        {"id": "ce-2", "label": "Confirm booth reservations", "owner": "Logistics officer", "status": "done", "position_x": 0, "position_y": 160},
        {"id": "ce-3", "label": "Promote via email & socials", "owner": "Marketing head", "status": "done", "position_x": 560, "position_y": 160},
        {"id": "ce-4", "label": "Prepare resume review station", "owner": "Career adviser", "status": "in-progress", "position_x": 0, "position_y": 320},
        {"id": "ce-5", "label": "Set up mock interview rooms", "owner": "HR volunteers", "status": "in-progress", "position_x": 280, "position_y": 320},
        {"id": "ce-6", "label": "Print attendee badges", "owner": "Secretary", "status": "in-progress", "position_x": 560, "position_y": 320},
        {"id": "ce-7", "label": "Run expo day", "owner": "Event manager", "status": "todo", "position_x": 140, "position_y": 480},
        {"id": "ce-8", "label": "Follow-up & analytics report", "owner": "Industry liaison", "status": "todo", "position_x": 420, "position_y": 480},
    ],
}
EVENT_PLAN_EDGES: Dict[int, List[Dict]] = {
    # 1 — Hackathon 2026
    1: [
        {"id": "hke-1", "source": "hk-1", "target": "hk-2"},
        {"id": "hke-2", "source": "hk-1", "target": "hk-3"},
        {"id": "hke-3", "source": "hk-1", "target": "hk-4"},
        {"id": "hke-4", "source": "hk-2", "target": "hk-5"},
        {"id": "hke-5", "source": "hk-3", "target": "hk-7"},
        {"id": "hke-6", "source": "hk-4", "target": "hk-6"},
        {"id": "hke-7", "source": "hk-5", "target": "hk-8"},
        {"id": "hke-8", "source": "hk-6", "target": "hk-8"},
        {"id": "hke-9", "source": "hk-7", "target": "hk-8"},
        {"id": "hke-10", "source": "hk-8", "target": "hk-9"},
    ],
    # 2 — TechTalks: AI & Cloud
    2: [
        {"id": "tte-1", "source": "tt-1", "target": "tt-2"},
        {"id": "tte-2", "source": "tt-1", "target": "tt-3"},
        {"id": "tte-3", "source": "tt-1", "target": "tt-4"},
        {"id": "tte-4", "source": "tt-3", "target": "tt-5"},
        {"id": "tte-5", "source": "tt-4", "target": "tt-5"},
        {"id": "tte-6", "source": "tt-2", "target": "tt-6"},
        {"id": "tte-7", "source": "tt-6", "target": "tt-7"},
        {"id": "tte-8", "source": "tt-5", "target": "tt-8"},
        {"id": "tte-9", "source": "tt-7", "target": "tt-8"},
    ],
    # 3 — Cybersecurity CTF
    3: [
        {"id": "ctfe-1", "source": "ctf-1", "target": "ctf-2"},
        {"id": "ctfe-2", "source": "ctf-1", "target": "ctf-3"},
        {"id": "ctfe-3", "source": "ctf-1", "target": "ctf-4"},
        {"id": "ctfe-4", "source": "ctf-2", "target": "ctf-5"},
        {"id": "ctfe-5", "source": "ctf-3", "target": "ctf-5"},
        {"id": "ctfe-6", "source": "ctf-2", "target": "ctf-6"},
        {"id": "ctfe-7", "source": "ctf-5", "target": "ctf-7"},
        {"id": "ctfe-8", "source": "ctf-6", "target": "ctf-7"},
        {"id": "ctfe-9", "source": "ctf-7", "target": "ctf-8"},
    ],
    # 4 — UI/UX Design Jam
    4: [
        {"id": "uxe-1", "source": "ux-1", "target": "ux-2"},
        {"id": "uxe-2", "source": "ux-1", "target": "ux-3"},
        {"id": "uxe-3", "source": "ux-2", "target": "ux-4"},
        {"id": "uxe-4", "source": "ux-1", "target": "ux-5"},
        {"id": "uxe-5", "source": "ux-3", "target": "ux-6"},
        {"id": "uxe-6", "source": "ux-4", "target": "ux-7"},
        {"id": "uxe-7", "source": "ux-5", "target": "ux-7"},
        {"id": "uxe-8", "source": "ux-6", "target": "ux-8"},
        {"id": "uxe-9", "source": "ux-7", "target": "ux-8"},
    ],
    # 5 — DevOps Workshop Series
    5: [
        {"id": "dwe-1", "source": "dw-1", "target": "dw-2"},
        {"id": "dwe-2", "source": "dw-1", "target": "dw-3"},
        {"id": "dwe-3", "source": "dw-1", "target": "dw-4"},
        {"id": "dwe-4", "source": "dw-2", "target": "dw-5"},
        {"id": "dwe-5", "source": "dw-3", "target": "dw-6"},
        {"id": "dwe-6", "source": "dw-4", "target": "dw-5"},
        {"id": "dwe-7", "source": "dw-5", "target": "dw-7"},
        {"id": "dwe-8", "source": "dw-6", "target": "dw-7"},
        {"id": "dwe-9", "source": "dw-7", "target": "dw-8"},
    ],
    # 6 — Tech Career Expo
    6: [
        {"id": "cee-1", "source": "ce-1", "target": "ce-2"},
        {"id": "cee-2", "source": "ce-1", "target": "ce-3"},
        {"id": "cee-3", "source": "ce-2", "target": "ce-4"},
        {"id": "cee-4", "source": "ce-2", "target": "ce-5"},
        {"id": "cee-5", "source": "ce-3", "target": "ce-6"},
        {"id": "cee-6", "source": "ce-4", "target": "ce-7"},
        {"id": "cee-7", "source": "ce-5", "target": "ce-7"},
        {"id": "cee-8", "source": "ce-6", "target": "ce-7"},
        {"id": "cee-9", "source": "ce-7", "target": "ce-8"},
    ],
}

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
