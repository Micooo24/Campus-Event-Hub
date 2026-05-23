import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'

type EventItem = {
  id: number
  title: string
  date: string
  location: string
  capacity: number
  registeredCount: number
  description: string
}

type Report = {
  eventId: number
  registeredCount: number
  attendedCount: number
  attendanceRate: number
}

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
  source: string
  target: string
}

type EventPlan = {
  eventId: number
  steps: PlanStep[]
  edges: PlanEdge[]
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
const SCHEDULE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SCHEDULE_HOURS = [9, 12, 15, 18]

const pad = (value: number) => value.toString().padStart(2, '0')

const toDate = (value: string) => {
  const parsed = new Date(value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDateTime = (value: string) => {
  const parsed = toDate(value)
  if (!parsed) {
    return value
  }
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

const getScheduleSlot = (value: string) => {
  const parsed = toDate(value)
  if (!parsed) {
    return null
  }
  const dayIndex = (parsed.getDay() + 6) % 7
  const hour = parsed.getHours()
  const closestHour = SCHEDULE_HOURS.reduce((closest, current) =>
    Math.abs(current - hour) < Math.abs(closest - hour) ? current : closest,
  )
  return { dayIndex, hour: closestHour }
}

const toDateInputValue = (value: string) => {
  const parsed = toDate(value)
  if (!parsed) {
    return ''
  }
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

const toDefaultDateTime = () => {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() + 1)
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )} ${pad(now.getHours())}:00`
}

const toMonthKey = (value: string) => {
  const parsed = toDate(value)
  if (!parsed) {
    return null
  }
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}`
}

const formatMonthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) {
    return key
  }
  const date = new Date(year, month - 1, 1)
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

const getCurrentMonthKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

const FAQS = [
  'What can this app do?',
  'How do I create a tech event?',
  'How does the flowchart planner work?',
  'What roles can I assign to steps?',
  'How do I connect steps in the flow?',
  'Can I track attendance and reports?',
]

const STATUS_COLORS: Record<string, string> = {
  todo: '#e2e8f0',
  'in-progress': 'rgba(15, 138, 122, 0.15)',
  done: 'rgba(34, 197, 94, 0.15)',
}

const STATUS_BORDER: Record<string, string> = {
  todo: '#cbd5e1',
  'in-progress': 'rgba(15, 138, 122, 0.5)',
  done: 'rgba(34, 197, 94, 0.5)',
}

type StepNodeData = {
  label: string
  owner: string
  status: PlanStep['status']
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function StepNode({ id, data }: NodeProps<Node<StepNodeData>>) {
  return (
    <div
      className="flow-node"
      style={{
        background: STATUS_COLORS[data.status] ?? '#e2e8f0',
        borderColor: STATUS_BORDER[data.status] ?? '#cbd5e1',
      }}
    >
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="flow-node-content">
        <strong>{data.label}</strong>
        <span className="flow-node-owner">{data.owner}</span>
        <span className={`flow-node-status ${data.status}`}>
          {data.status.replace('-', ' ')}
        </span>
      </div>
      <div className="flow-node-actions">
        <button type="button" onClick={() => data.onEdit(id)}>Edit</button>
        <button type="button" className="danger" onClick={() => data.onDelete(id)}>Del</button>
      </div>
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  )
}

const nodeTypes: NodeTypes = { step: StepNode }

function App() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eventError, setEventError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [isEventSaving, setIsEventSaving] = useState(false)
  const [eventDraft, setEventDraft] = useState<{
    id: number | null
    title: string
    date: string
    location: string
    capacity: string
    description: string
  }>({
    id: null,
    title: '',
    date: toDefaultDateTime(),
    location: '',
    capacity: '',
    description: '',
  })
  const [plansByEvent, setPlansByEvent] = useState<Record<number, PlanStep[]>>({})
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [isPlanSaving, setIsPlanSaving] = useState(false)
  const [isPlanOpen, setIsPlanOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        'Hi! I can help you with event planning, flowcharts, and how this app works. Pick a question or ask your own!',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  const [isChatSending, setIsChatSending] = useState(false)
  const [planDraft, setPlanDraft] = useState<{
    id: string | null
    label: string
    owner: string
    status: PlanStep['status']
    position_x: number
    position_y: number
  }>({ id: null, label: '', owner: '', status: 'todo', position_x: 0, position_y: 0 })

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  )

  const monthOptions = useMemo(() => {
    const keys = new Set<string>()
    events.forEach((event) => {
      const key = toMonthKey(event.date)
      if (key) {
        keys.add(key)
      }
    })
    return Array.from(keys)
      .sort()
      .map((key) => ({ key, label: formatMonthLabel(key) }))
  }, [events])

  const filteredEvents = useMemo(() => {
    if (selectedMonth === 'all') {
      return events
    }
    return events.filter((event) => toMonthKey(event.date) === selectedMonth)
  }, [events, selectedMonth])

  const scheduleBuckets = useMemo(() => {
    const buckets: Record<string, EventItem[]> = {}
    filteredEvents.forEach((event) => {
      const slot = getScheduleSlot(event.date)
      if (!slot) {
        return
      }
      const key = `${slot.dayIndex}-${slot.hour}`
      buckets[key] = [...(buckets[key] ?? []), event]
    })
    return buckets
  }, [filteredEvents])

  const sortedEvents = useMemo(
    () =>
      [...filteredEvents].sort((a, b) => {
        const dateA = toDate(a.date)?.getTime() ?? 0
        const dateB = toDate(b.date)?.getTime() ?? 0
        return dateA - dateB
      }),
    [filteredEvents],
  )

  const [edgesByEvent, setEdgesByEvent] = useState<Record<number, PlanEdge[]>>({})

  const selectedPlan = useMemo<EventPlan | null>(() => {
    if (selectedEventId === null) {
      return null
    }
    return {
      eventId: selectedEventId,
      steps: plansByEvent[selectedEventId] ?? [],
      edges: edgesByEvent[selectedEventId] ?? [],
    }
  }, [plansByEvent, edgesByEvent, selectedEventId])

  const flowSteps = selectedPlan?.steps ?? []

  const loadEvents = async (preferredId?: number | null) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE}/events`)
      if (!response.ok) {
        throw new Error('Unable to load events.')
      }
      const data: EventItem[] = await response.json()
      setEvents(data)
      if (data.length === 0) {
        setSelectedEventId(null)
        return
      }
      const nextSelected =
        (preferredId && data.find((event) => event.id === preferredId)?.id) ??
        (selectedEventId && data.find((event) => event.id === selectedEventId)?.id) ??
        data[0].id
      setSelectedEventId(nextSelected)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Load failed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  useEffect(() => {
    if (selectedMonth !== 'all' && !monthOptions.find((option) => option.key === selectedMonth)) {
      setSelectedMonth('all')
    }
  }, [monthOptions, selectedMonth])

  useEffect(() => {
    const loadReport = async (eventId: number) => {
      try {
        const response = await fetch(`${API_BASE}/events/${eventId}/report`)
        if (!response.ok) {
          throw new Error('Unable to load report.')
        }
        const data: Report = await response.json()
        setReport(data)
      } catch {
        setReport(null)
      }
    }

    if (selectedEventId !== null) {
      loadReport(selectedEventId)
    }
  }, [selectedEventId])

  const resetEventDraft = () => {
    setEventDraft({
      id: null,
      title: '',
      date: toDefaultDateTime(),
      location: '',
      capacity: '',
      description: '',
    })
  }

  const handleEventSubmit = async () => {
    if (!eventDraft.title.trim()) {
      setEventError('Event title is required.')
      return
    }
    if (!eventDraft.date.trim()) {
      setEventError('Event date is required.')
      return
    }
    if (!eventDraft.location.trim()) {
      setEventError('Event location is required.')
      return
    }
    const capacityValue = Number.parseInt(eventDraft.capacity, 10)
    if (Number.isNaN(capacityValue) || capacityValue <= 0) {
      setEventError('Capacity must be a positive number.')
      return
    }

    try {
      setIsEventSaving(true)
      setEventError(null)
      const endpoint = eventDraft.id
        ? `${API_BASE}/events/${eventDraft.id}`
        : `${API_BASE}/events`
      const response = await fetch(endpoint, {
        method: eventDraft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventDraft.title.trim(),
          date: eventDraft.date.trim(),
          location: eventDraft.location.trim(),
          capacity: capacityValue,
          description: eventDraft.description.trim(),
        }),
      })

      if (!response.ok) {
        const errorPayload = await response.json()
        throw new Error(errorPayload?.detail ?? 'Unable to save event.')
      }

      const savedEvent: EventItem = await response.json()
      await loadEvents(savedEvent.id)
      resetEventDraft()
    } catch (saveError) {
      setEventError(saveError instanceof Error ? saveError.message : 'Save failed.')
    } finally {
      setIsEventSaving(false)
    }
  }

  const handleEventEdit = (event: EventItem) => {
    setSelectedEventId(event.id)
    setEventDraft({
      id: event.id,
      title: event.title,
      date: event.date,
      location: event.location,
      capacity: String(event.capacity),
      description: event.description,
    })
  }

  const handleEventDelete = async (eventId: number) => {
    try {
      setIsEventSaving(true)
      setEventError(null)
      const response = await fetch(`${API_BASE}/events/${eventId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const errorPayload = await response.json()
        throw new Error(errorPayload?.detail ?? 'Unable to delete event.')
      }

      setPlansByEvent((prev) => {
        const next = { ...prev }
        delete next[eventId]
        return next
      })
      if (eventDraft.id === eventId) {
        resetEventDraft()
      }
      await loadEvents(selectedEventId === eventId ? null : selectedEventId)
    } catch (deleteError) {
      setEventError(
        deleteError instanceof Error ? deleteError.message : 'Delete failed.',
      )
    } finally {
      setIsEventSaving(false)
    }
  }

  useEffect(() => {
    const loadPlan = async (eventId: number) => {
      try {
        setPlanLoading(true)
        setPlanError(null)
        const response = await fetch(`${API_BASE}/events/${eventId}/plan`)
        if (!response.ok) {
          throw new Error('Unable to load plan.')
        }
        const data: EventPlan = await response.json()
        setPlansByEvent((prev) => ({ ...prev, [eventId]: data.steps ?? [] }))
        setEdgesByEvent((prev) => ({ ...prev, [eventId]: data.edges ?? [] }))
      } catch (loadError) {
        setPlanError(loadError instanceof Error ? loadError.message : 'Load failed.')
      } finally {
        setPlanLoading(false)
      }
    }

    if (selectedEventId !== null) {
      loadPlan(selectedEventId)
    }
  }, [selectedEventId])

  useEffect(() => {
    if (!selectedEvent || eventDraft.id) {
      return
    }

    setEventDraft((prev) => ({
      ...prev,
      date: selectedEvent.date,
    }))
  }, [selectedEvent, eventDraft.id])

  const resetPlanDraft = () => {
    setPlanDraft({ id: null, label: '', owner: '', status: 'todo', position_x: 0, position_y: 0 })
  }

  const handlePlanSubmit = async () => {
    if (!selectedEventId) {
      return
    }
    if (!planDraft.label.trim() || !planDraft.owner.trim()) {
      setPlanError('Step label and role owner are required.')
      return
    }

    const isNew = !planDraft.id
    const pos = isNew ? getNextPosition() : { x: planDraft.position_x, y: planDraft.position_y }

    try {
      setIsPlanSaving(true)
      setPlanError(null)
      const endpoint = planDraft.id
        ? `${API_BASE}/events/${selectedEventId}/plan/steps/${planDraft.id}`
        : `${API_BASE}/events/${selectedEventId}/plan/steps`
      const response = await fetch(endpoint, {
        method: planDraft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: planDraft.label.trim(),
          owner: planDraft.owner.trim(),
          status: planDraft.status,
          position_x: pos.x,
          position_y: pos.y,
        }),
      })

      if (!response.ok) {
        const errorPayload = await response.json()
        throw new Error(errorPayload?.detail ?? 'Unable to save plan step.')
      }

      const data: EventPlan = await response.json()
      setPlansByEvent((prev) => ({ ...prev, [selectedEventId]: data.steps ?? [] }))
      setEdgesByEvent((prev) => ({ ...prev, [selectedEventId]: data.edges ?? [] }))
      resetPlanDraft()
    } catch (planError) {
      setPlanError(planError instanceof Error ? planError.message : 'Save failed.')
    } finally {
      setIsPlanSaving(false)
    }
  }

  const handlePlanEdit = (step: PlanStep) => {
    setPlanDraft({
      id: step.id,
      label: step.label,
      owner: step.owner,
      status: step.status,
      position_x: step.position_x,
      position_y: step.position_y,
    })
  }

  const handlePlanDelete = async (stepId: string) => {
    if (!selectedEventId) {
      return
    }
    try {
      setIsPlanSaving(true)
      setPlanError(null)
      const response = await fetch(
        `${API_BASE}/events/${selectedEventId}/plan/steps/${stepId}`,
        { method: 'DELETE' },
      )
      if (!response.ok) {
        const errorPayload = await response.json()
        throw new Error(errorPayload?.detail ?? 'Unable to delete plan step.')
      }

      const data: EventPlan = await response.json()
      setPlansByEvent((prev) => ({ ...prev, [selectedEventId]: data.steps ?? [] }))
      setEdgesByEvent((prev) => ({ ...prev, [selectedEventId]: data.edges ?? [] }))
      if (planDraft.id === stepId) {
        resetPlanDraft()
      }
    } catch (planError) {
      setPlanError(planError instanceof Error ? planError.message : 'Delete failed.')
    } finally {
      setIsPlanSaving(false)
    }
  }

  const flowNodes = useMemo<Node<StepNodeData>[]>(() => {
    return flowSteps.map((step, index) => ({
      id: step.id,
      type: 'step',
      position: {
        x: step.position_x ?? (index % 3) * 280,
        y: step.position_y ?? Math.floor(index / 3) * 180,
      },
      data: {
        label: step.label,
        owner: step.owner,
        status: step.status,
        onEdit: (id: string) => {
          const s = flowSteps.find((fs) => fs.id === id)
          if (s) handlePlanEdit(s)
        },
        onDelete: (id: string) => handlePlanDelete(id),
      },
    }))
  }, [flowSteps])

  const flowEdges = useMemo<Edge[]>(() => {
    return (selectedPlan?.edges ?? []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: 'var(--accent)', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed' as const, color: 'var(--accent)' },
    }))
  }, [selectedPlan?.edges])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node<StepNodeData>>(flowNodes)
  const [rfEdges, setRfEdges, onEdgesChangeBase] = useEdgesState(flowEdges)

  const onEdgesChange = useCallback(
    (changes: import('@xyflow/react').EdgeChange[]) => {
      const removals = changes.filter((c) => c.type === 'remove')
      if (removals.length > 0 && selectedEventId) {
        for (const removal of removals) {
          if (removal.type === 'remove') {
            fetch(
              `${API_BASE}/events/${selectedEventId}/plan/edges/${removal.id}`,
              { method: 'DELETE' },
            )
              .then((res) => {
                if (res.ok) return res.json()
              })
              .then((data) => {
                if (data) {
                  setEdgesByEvent((prev) => ({ ...prev, [selectedEventId]: data.edges ?? [] }))
                }
              })
              .catch(() => {})
          }
        }
      }
      onEdgesChangeBase(changes)
    },
    [onEdgesChangeBase, selectedEventId],
  )

  useEffect(() => {
    setRfNodes(flowNodes)
  }, [flowNodes, setRfNodes])

  useEffect(() => {
    setRfEdges(flowEdges)
  }, [flowEdges, setRfEdges])

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!selectedEventId || !connection.source || !connection.target) return
      if (connection.source === connection.target) return
      const alreadyExists = rfEdges.some(
        (e) => e.source === connection.source && e.target === connection.target,
      )
      if (alreadyExists) return
      setRfEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: 'var(--accent)', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed' as const, color: 'var(--accent)' } }, eds))
      try {
        const response = await fetch(
          `${API_BASE}/events/${selectedEventId}/plan/edges`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: connection.source, target: connection.target }),
          },
        )
        if (response.ok) {
          const data: EventPlan = await response.json()
          setEdgesByEvent((prev) => ({ ...prev, [selectedEventId]: data.edges ?? [] }))
        }
      } catch { /* edge will appear optimistically */ }
    },
    [selectedEventId, setRfEdges, rfEdges],
  )

  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (!selectedEventId) return
      try {
        await fetch(
          `${API_BASE}/events/${selectedEventId}/plan/steps/${node.id}/position`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position_x: node.position.x, position_y: node.position.y }),
          },
        )
        setPlansByEvent((prev) => {
          const steps = prev[selectedEventId] ?? []
          return {
            ...prev,
            [selectedEventId]: steps.map((s) =>
              s.id === node.id ? { ...s, position_x: node.position.x, position_y: node.position.y } : s
            ),
          }
        })
      } catch { /* position save failed silently */ }
    },
    [selectedEventId],
  )

  const getNextPosition = () => {
    const count = flowSteps.length
    const occupied = new Set(flowSteps.map((s) => `${Math.round(s.position_x)},${Math.round(s.position_y)}`))
    let x = (count % 3) * 280
    let y = Math.floor(count / 3) * 180
    let attempts = 0
    while (occupied.has(`${x},${y}`) && attempts < 20) {
      attempts++
      x = ((count + attempts) % 3) * 280
      y = Math.floor((count + attempts) / 3) * 180
    }
    return { x, y }
  }

  const handleChatSend = async (question: string) => {
    if (!question.trim()) {
      return
    }
    setChatMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: question },
    ])
    setChatInput('')
    try {
      setIsChatSending(true)
      setChatError(null)
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      })
      if (!response.ok) {
        const errorPayload = await response.json()
        throw new Error(errorPayload?.detail ?? 'Chat request failed.')
      }
      const data = await response.json()
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply ?? 'No response available yet.',
        },
      ])
    } catch (chatError) {
      setChatError(chatError instanceof Error ? chatError.message : 'Chat failed.')
    } finally {
      setIsChatSending(false)
    }
  }

  const handleChatReset = () => {
    setChatMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Hi! I can help you with event planning, flowcharts, and how this app works. Pick a question or ask your own!',
      },
    ])
    setChatInput('')
    setChatError(null)
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Student Org Event Desk</p>
          <h1>Plan, register, and report in one friendly hub.</h1>
          <p className="subtitle">
            A lightweight MVP for event planning, attendee registration, automated
            confirmations, and post-event reporting.
          </p>
          <div className="hero-actions">
            <span className="chip">In-memory MVP</span>
            <span className="chip">No auth</span>
            <span className="chip">Mocked emails</span>
          </div>
        </div>
        <div className="hero-panel">
          <div className="stat">
            <h2>{events.length}</h2>
            <p>Upcoming events</p>
          </div>
          <div className="stat">
            <h2>{events.reduce((sum, event) => sum + event.registeredCount, 0)}</h2>
            <p>Total registrations</p>
          </div>
          <div className="stat">
            <h2>{report ? report.attendanceRate.toFixed(0) : '--'}%</h2>
            <p>Latest attendance rate</p>
          </div>
        </div>
      </header>

      <main className="content">
        <section className="panel">
          <div className="panel-header">
            <h2>Event planning</h2>
            <p>Pick an event to manage registrations and attendance.</p>
          </div>
          <div className="event-manager">
            <div className="event-manager-header">
              <div>
                <h3>Event CRUD</h3>
                <p className="muted small">
                  Create, update, read, and delete events in the schedule.
                </p>
              </div>
            </div>
            {eventError && <div className="empty error">{eventError}</div>}
            <div className="event-manager-grid">
              <div className="event-manager-form">
                <h4>{eventDraft.id ? 'Update event' : 'Create event'}</h4>
                <div className="form">
                  <label>
                    Title
                    <input
                      value={eventDraft.title}
                      disabled={isEventSaving}
                      onChange={(event) =>
                        setEventDraft((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Hackathon Kickoff"
                      required
                    />
                  </label>
                  <label>
                    Date and time
                    <input
                      type="datetime-local"
                      value={toDateInputValue(eventDraft.date)}
                      disabled={isEventSaving}
                      onChange={(event) =>
                        setEventDraft((prev) => ({
                          ...prev,
                          date: event.target.value.replace('T', ' '),
                        }))
                      }
                      step="300"
                      required
                    />
                  </label>
                  <label>
                    Location
                    <input
                      value={eventDraft.location}
                      disabled={isEventSaving}
                      onChange={(event) =>
                        setEventDraft((prev) => ({
                          ...prev,
                          location: event.target.value,
                        }))
                      }
                      placeholder="Innovation Hub"
                      required
                    />
                  </label>
                  <label>
                    Capacity
                    <input
                      type="number"
                      min="1"
                      value={eventDraft.capacity}
                      disabled={isEventSaving}
                      onChange={(event) =>
                        setEventDraft((prev) => ({
                          ...prev,
                          capacity: event.target.value,
                        }))
                      }
                      placeholder="120"
                      required
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      value={eventDraft.description}
                      disabled={isEventSaving}
                      onChange={(event) =>
                        setEventDraft((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Share what attendees will experience."
                      rows={3}
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={handleEventSubmit}
                      disabled={isEventSaving}
                    >
                      {isEventSaving
                        ? 'Saving...'
                        : eventDraft.id
                          ? 'Update event'
                          : 'Create event'}
                    </button>
                    {eventDraft.id && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={resetEventDraft}
                        disabled={isEventSaving}
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="event-manager-list">
                {events.length ? (
                  events.map((event) => (
                    <div
                      key={`manager-${event.id}`}
                      className={`event-row ${
                        selectedEventId === event.id ? 'selected' : ''
                      }`}
                    >
                      <div>
                        <strong>{event.title}</strong>
                        <p className="muted small">{formatDateTime(event.date)}</p>
                        <p className="muted small">{event.location}</p>
                      </div>
                      <div className="event-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleEventEdit(event)}
                          disabled={isEventSaving}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => handleEventDelete(event.id)}
                          disabled={isEventSaving}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty">No events available yet.</div>
                )}
              </div>
            </div>
          </div>
          {loading ? (
            <div className="empty">Loading events...</div>
          ) : error ? (
            <div className="empty error">{error}</div>
          ) : (
            <div className="event-list">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={`event-card ${
                    selectedEventId === event.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedEventId(event.id)}
                >
                  <div>
                    <h3>{event.title}</h3>
                    <p className="muted">{event.date}</p>
                    <p className="muted">{event.location}</p>
                  </div>
                  <div className="tag">
                    {event.registeredCount}/{event.capacity}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="scheduler">
            <div className="scheduler-header">
              <div>
                <h3>Week view scheduler</h3>
                <p className="muted small">Drag-and-drop planning coming next.</p>
              </div>
              <div className="scheduler-filters">
                <label className="select-label">
                  Month
                  <select
                    className="select-control"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  >
                    <option value="all">All months</option>
                    {monthOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setSelectedMonth(getCurrentMonthKey())}
                >
                  Current month
                </button>
                <span className="chip">Mock data</span>
              </div>
            </div>
            <div className="scheduler-grid">
              <div className="scheduler-cell head"></div>
              {SCHEDULE_DAYS.map((day) => (
                <div key={day} className="scheduler-cell head">
                  {day}
                </div>
              ))}
              {SCHEDULE_HOURS.map((hour) => (
                <div key={hour} className="scheduler-row">
                  <div className="scheduler-cell time">{pad(hour)}:00</div>
                  {SCHEDULE_DAYS.map((day, dayIndex) => {
                    const key = `${dayIndex}-${hour}`
                    const slotEvents = scheduleBuckets[key] ?? []
                    const firstEvent = slotEvents[0]

                    return (
                      <div key={`${day}-${hour}`} className="scheduler-cell slot">
                        {firstEvent ? (
                          <div
                            className={`event-chip ${
                              selectedEventId === firstEvent.id ? 'active' : ''
                            }`}
                          >
                            <span>{firstEvent.title}</span>
                            {slotEvents.length > 1 && (
                              <span className="chip-count">
                                +{slotEvents.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="slot-empty">—</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="timeline">
              <h4>Upcoming timeline</h4>
              <div className="timeline-list">
                {sortedEvents.map((event) => (
                  <button
                    key={`timeline-${event.id}`}
                    type="button"
                    className={`timeline-item ${
                      selectedEventId === event.id ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <div>
                      <p className="muted small">{formatDateTime(event.date)}</p>
                      <strong>{event.title}</strong>
                    </div>
                    <span className="chip">{event.location}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="scheduler-plan">
              <div className="scheduler-plan-header">
                <div>
                  <h4>Plan steps</h4>
                  <p className="muted small">
                    CRUD for flowchart and assignees inside scheduling.
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsPlanOpen(true)}
                >
                  Open full planner
                </button>
              </div>
              {planLoading ? (
                <div className="empty">Loading plan...</div>
              ) : planError ? (
                <div className="empty error">{planError}</div>
              ) : (
                <div className="scheduler-plan-grid">
                  <div className="scheduler-plan-list">
                    {flowSteps.length ? (
                      flowSteps.map((step) => (
                        <div key={step.id} className="plan-card compact">
                          <div>
                            <strong>{step.label}</strong>
                            <p className="muted small">Assignee: {step.owner}</p>
                            <span className={`flow-status ${step.status}`}>
                              {step.status.replace('-', ' ')}
                            </span>
                          </div>
                          <div className="plan-actions">
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => handlePlanEdit(step)}
                              disabled={isPlanSaving}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="ghost-button danger"
                              onClick={() => handlePlanDelete(step.id)}
                              disabled={isPlanSaving}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty">Add the first step and assignee.</div>
                    )}
                  </div>
                  <div className="scheduler-plan-form">
                    <h4>{planDraft.id ? 'Update step' : 'Create step'}</h4>
                    <div className="form">
                      <label>
                        Step label
                        <input
                          value={planDraft.label}
                          disabled={isPlanSaving}
                          onChange={(event) =>
                            setPlanDraft((prev) => ({
                              ...prev,
                              label: event.target.value,
                            }))
                          }
                          placeholder="Secure vendors"
                          required
                        />
                      </label>
                      <label>
                        Assignee name
                        <input
                          value={planDraft.owner}
                          disabled={isPlanSaving}
                          onChange={(event) =>
                            setPlanDraft((prev) => ({
                              ...prev,
                              owner: event.target.value,
                            }))
                          }
                          placeholder="Sam Lee"
                          required
                        />
                      </label>
                      <label>
                        Status
                        <select
                          value={planDraft.status}
                          disabled={isPlanSaving}
                          onChange={(event) =>
                            setPlanDraft((prev) => ({
                              ...prev,
                              status: event.target.value as PlanStep['status'],
                            }))
                          }
                        >
                          <option value="todo">To do</option>
                          <option value="in-progress">In progress</option>
                          <option value="done">Done</option>
                        </select>
                      </label>
                      <div className="form-actions">
                        <button
                          type="button"
                          onClick={handlePlanSubmit}
                          disabled={isPlanSaving}
                        >
                          {isPlanSaving
                            ? 'Saving...'
                            : planDraft.id
                              ? 'Update step'
                              : 'Add step'}
                        </button>
                        {planDraft.id && (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={resetPlanDraft}
                            disabled={isPlanSaving}
                          >
                            Cancel edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel detail">
          {selectedEvent ? (
            <>
              <div className="panel-header">
                <h2>{selectedEvent.title}</h2>
                <p>{selectedEvent.description}</p>
                <div className="panel-actions">
                  <button
                    type="button"
                    className="plan-button"
                    onClick={() => setIsPlanOpen(true)}
                  >
                    Plan
                  </button>
                  <span className="chip">
                    {flowSteps.length ? `${flowSteps.length} steps` : 'No plan yet'}
                  </span>
                </div>
              </div>
              <div className="flow-preview">
                <h3>Execution flow</h3>
                {planLoading ? (
                  <div className="empty">Loading plan...</div>
                ) : planError ? (
                  <div className="empty error">{planError}</div>
                ) : flowSteps.length ? (
                  <ol className="flow-list">
                    {flowSteps.map((step, index) => (
                      <li key={step.id} className="flow-item">
                        <div>
                          <span className="flow-index">{index + 1}</span>
                          <strong>{step.label}</strong>
                          <span className="muted small">{step.owner}</span>
                        </div>
                        <span className={`flow-status ${step.status}`}>
                          {step.status.replace('-', ' ')}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="empty">No execution plan yet.</div>
                )}
              </div>
              <div className="detail-grid">
                <div>
                  <h3>Event execution</h3>
                  <p className="muted small">
                    Keep your plan, roles, and timeline aligned for every event.
                  </p>
                </div>
              </div>
              <div className="report">
                <h3>Post-event report</h3>
                {report ? (
                  <div className="report-grid">
                    <div>
                      <h4>Registered</h4>
                      <p>{report.registeredCount}</p>
                    </div>
                    <div>
                      <h4>Attended</h4>
                      <p>{report.attendedCount}</p>
                    </div>
                    <div>
                      <h4>Attendance rate</h4>
                      <p>{report.attendanceRate.toFixed(0)}%</p>
                    </div>
                  </div>
                ) : (
                  <div className="empty">Report will appear once data is ready.</div>
                )}
              </div>
              <div className="chat-panel">
                <div className="chat-header">
                  <div>
                    <h3>AI Assistant</h3>
                    <p className="muted small">
                      Ask about events, flowcharts, or how to use the platform.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleChatReset}
                  >
                    Reset
                  </button>
                </div>
                {chatError && <div className="empty error">{chatError}</div>}
                <div className="chat-messages">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-bubble ${message.role}`}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
                <form
                  className="chat-input"
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleChatSend(chatInput)
                  }}
                >
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Ask about the event app..."
                    disabled={isChatSending}
                  />
                  <button type="submit" disabled={isChatSending}>
                    {isChatSending ? 'Sending...' : 'Send'}
                  </button>
                </form>
                <div className="chat-questions">
                  {FAQS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="question-chip"
                      onClick={() => handleChatSend(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty">Select an event to see details.</div>
          )}
        </section>
      </main>

      {isPlanOpen && selectedEvent && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-flow">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Event flow</p>
                <h2>{selectedEvent.title}</h2>
                <p className="muted small">
                  Drag nodes to rearrange. Connect steps by dragging from one handle to another.
                </p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setIsPlanOpen(false)
                  resetPlanDraft()
                }}
              >
                Close
              </button>
            </div>

            <div className="flow-layout">
              <div className="flow-canvas-wrap">
                {planLoading ? (
                  <div className="empty">Loading plan...</div>
                ) : planError ? (
                  <div className="empty error">{planError}</div>
                ) : (
                  <ReactFlow
                    nodes={rfNodes}
                    edges={rfEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeDragStop={onNodeDragStop}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.3 }}
                    deleteKeyCode="Delete"
                    className="flow-canvas"
                  >
                    <Background gap={20} size={1} />
                    <Controls showInteractive={false} />
                    <MiniMap
                      nodeStrokeWidth={3}
                      pannable
                      zoomable
                      style={{ borderRadius: 12 }}
                    />
                  </ReactFlow>
                )}
              </div>

              <div className="flow-sidebar">
                <h3>{planDraft.id ? 'Update step' : 'Add step'}</h3>
                <div className="form">
                  <label>
                    Step label
                    <input
                      value={planDraft.label}
                      disabled={isPlanSaving}
                      onChange={(event) =>
                        setPlanDraft((prev) => ({
                          ...prev,
                          label: event.target.value,
                        }))
                      }
                      placeholder="Confirm speakers"
                      required
                    />
                  </label>
                  <label>
                    Role owner
                    <input
                      value={planDraft.owner}
                      disabled={isPlanSaving}
                      onChange={(event) =>
                        setPlanDraft((prev) => ({
                          ...prev,
                          owner: event.target.value,
                        }))
                      }
                      placeholder="Logistics lead"
                      required
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={planDraft.status}
                      disabled={isPlanSaving}
                      onChange={(event) =>
                        setPlanDraft((prev) => ({
                          ...prev,
                          status: event.target.value as PlanStep['status'],
                        }))
                      }
                    >
                      <option value="todo">To do</option>
                      <option value="in-progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                  </label>
                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={handlePlanSubmit}
                      disabled={isPlanSaving}
                    >
                      {isPlanSaving
                        ? 'Saving...'
                        : planDraft.id
                          ? 'Update step'
                          : 'Add step'}
                    </button>
                    {planDraft.id && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={resetPlanDraft}
                        disabled={isPlanSaving}
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </div>

                <div className="flow-sidebar-legend">
                  <h4>Legend</h4>
                  <div className="legend-items">
                    <span className="legend-item">
                      <span className="legend-dot todo" /> To do
                    </span>
                    <span className="legend-item">
                      <span className="legend-dot in-progress" /> In progress
                    </span>
                    <span className="legend-item">
                      <span className="legend-dot done" /> Done
                    </span>
                  </div>
                </div>

                <div className="flow-sidebar-info">
                  <p className="muted small">
                    {flowSteps.length} step{flowSteps.length !== 1 ? 's' : ''} &middot; {(selectedPlan?.edges ?? []).length} connection{(selectedPlan?.edges ?? []).length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
