import { useState, useContext, useMemo } from 'react'
import { DataContext, AuthContext } from '../App'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'
import './Tasks.css'

function Tasks() {
    const { tasks, addTask, updateTask, deleteTask, toggleTask } = useContext(DataContext)
    const { user } = useContext(AuthContext)
    const { calendars, fetchCalendars, createEvent } = useGoogleCalendar()
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [isCreating, setIsCreating] = useState(false)
    const [draggedTask, setDraggedTask] = useState(null)

    // Collapsed state for columns
    const [collapsed, setCollapsed] = useState({
        backlog: false,
        todo: false,
        inProgress: false,
        done: false
    })

    const toggleCollapse = (column) => {
        setCollapsed(prev => ({ ...prev, [column]: !prev[column] }))
    }

    // Form state
    const [newTask, setNewTask] = useState({
        title: '',
        dueDate: '',
        dueTime: '09:00',
        priority: 'medium',
        addToCalendar: false,
        calendarId: 'primary',
        duration: 60,
        status: 'backlog'
    })

    const today = new Date().toISOString().split('T')[0]

    // Calculate sprint dates (current week)
    const getSprintDates = () => {
        const now = new Date()
        const dayOfWeek = now.getDay()
        const monday = new Date(now)
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        monday.setHours(0, 0, 0, 0)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        return { start: monday, end: sunday }
    }

    const sprintDates = getSprintDates()
    const sprintLabel = `${sprintDates.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sprintDates.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

    // Categorize tasks
    const categorizedTasks = useMemo(() => {
        const backlog = [], todo = [], inProgress = [], done = []

        tasks.forEach(task => {
            const status = task.status || 'backlog'
            if (task.completed) done.push(task)
            else if (status === 'in-progress') inProgress.push(task)
            else if (status === 'todo') todo.push(task)
            else backlog.push(task)
        })

        const prioritySort = (a, b) => {
            const order = { high: 0, medium: 1, low: 2 }
            return order[a.priority] - order[b.priority]
        }

        return {
            backlog: backlog.sort(prioritySort),
            todo: todo.sort(prioritySort),
            inProgress: inProgress.sort(prioritySort),
            done: done.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
        }
    }, [tasks])

    // Sprint stats
    const sprintStats = {
        total: categorizedTasks.todo.length + categorizedTasks.inProgress.length + categorizedTasks.done.length,
        done: categorizedTasks.done.length,
        progress: categorizedTasks.todo.length + categorizedTasks.inProgress.length + categorizedTasks.done.length > 0
            ? Math.round((categorizedTasks.done.length / (categorizedTasks.todo.length + categorizedTasks.inProgress.length + categorizedTasks.done.length)) * 100)
            : 0
    }

    // Drag and drop
    const handleDragStart = (e, task) => {
        setDraggedTask(task)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDrop = (e, newStatus) => {
        e.preventDefault()
        if (draggedTask) {
            moveTask(draggedTask.id, newStatus)
            setDraggedTask(null)
        }
    }

    const moveTask = (taskId, newStatus) => {
        if (newStatus === 'done') {
            updateTask(taskId, { status: newStatus, completed: true, completedAt: new Date().toISOString() })
        } else {
            updateTask(taskId, { status: newStatus, completed: false })
        }
    }

    const handleOpenForm = async (initialStatus = 'backlog') => {
        setNewTask(prev => ({ ...prev, status: initialStatus }))
        setShowForm(true)
        if (calendars.length === 0) await fetchCalendars()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!newTask.title.trim()) return
        setIsCreating(true)

        try {
            let calendarEventId = null
            if (newTask.addToCalendar && newTask.dueDate) {
                const startDateTime = new Date(`${newTask.dueDate}T${newTask.dueTime}:00`)
                const endDateTime = new Date(startDateTime.getTime() + newTask.duration * 60 * 1000)
                const event = {
                    summary: `📋 ${newTask.title}`,
                    description: `Task from LifeOS\nPriority: ${newTask.priority}`,
                    start: { dateTime: startDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    end: { dateTime: endDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
                }
                const createdEvent = await createEvent(newTask.calendarId, event)
                calendarEventId = createdEvent?.id
            }

            addTask({
                title: newTask.title.trim(),
                dueDate: newTask.dueDate || null,
                priority: newTask.priority,
                status: newTask.status,
                calendarEventId
            })

            setNewTask({ title: '', dueDate: '', dueTime: '09:00', priority: 'medium', addToCalendar: false, calendarId: 'primary', duration: 60, status: 'backlog' })
            setShowForm(false)
        } catch (error) {
            console.error('Error:', error)
            addTask({ title: newTask.title.trim(), dueDate: newTask.dueDate || null, priority: newTask.priority, status: newTask.status })
            setShowForm(false)
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="sprint-page">
            {/* Header */}
            <header className="sprint-header">
                <div className="sprint-header-left">
                    <h1>Sprint Board</h1>
                    <span className="sprint-dates">{sprintLabel}</span>
                </div>
                <div className="sprint-header-right">
                    <div className="sprint-progress">
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${sprintStats.progress}%` }} />
                        </div>
                        <span className="progress-text">{sprintStats.done}/{sprintStats.total} done</span>
                    </div>
                    <button className="btn btn-primary" onClick={() => handleOpenForm('backlog')}>
                        <PlusIcon /> Add Task
                    </button>
                </div>
            </header>

            {/* Board */}
            <div className="board">
                {/* Backlog Column */}
                <div className={`board-column backlog-column ${collapsed.backlog ? 'collapsed' : ''}`}>
                    <div className="column-header" onClick={() => toggleCollapse('backlog')}>
                        <div className="column-header-left">
                            <CollapseIcon collapsed={collapsed.backlog} />
                            <h2><BacklogIcon /> Backlog</h2>
                        </div>
                        <span className="column-count">{categorizedTasks.backlog.length}</span>
                    </div>
                    {!collapsed.backlog && (
                        <div className="column-content" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'backlog')}>
                            {categorizedTasks.backlog.map(task => (
                                <TaskCard key={task.id} task={task} today={today}
                                    onDragStart={(e) => handleDragStart(e, task)}
                                    onDelete={() => deleteTask(task.id)}
                                    onMoveToSprint={() => moveTask(task.id, 'todo')}
                                    onEdit={() => setEditingId(task.id)}
                                    isEditing={editingId === task.id}
                                    onSave={(updates) => { updateTask(task.id, updates); setEditingId(null) }}
                                    onCancel={() => setEditingId(null)}
                                />
                            ))}
                            {categorizedTasks.backlog.length === 0 && (
                                <div className="empty-column">
                                    <p>No tasks in backlog</p>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleOpenForm('backlog')}>+ Add task</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sprint Columns */}
                <div className="sprint-columns">
                    {/* To Do */}
                    <div className={`board-column ${collapsed.todo ? 'collapsed' : ''}`}>
                        <div className="column-header" onClick={() => toggleCollapse('todo')}>
                            <div className="column-header-left">
                                <CollapseIcon collapsed={collapsed.todo} />
                                <h2><TodoIcon /> To Do</h2>
                            </div>
                            <span className="column-count">{categorizedTasks.todo.length}</span>
                        </div>
                        {!collapsed.todo && (
                            <div className="column-content" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'todo')}>
                                {categorizedTasks.todo.map(task => (
                                    <TaskCard key={task.id} task={task} today={today}
                                        onDragStart={(e) => handleDragStart(e, task)}
                                        onDelete={() => deleteTask(task.id)}
                                        onMoveNext={() => moveTask(task.id, 'in-progress')}
                                        onMoveBack={() => moveTask(task.id, 'backlog')}
                                        onEdit={() => setEditingId(task.id)}
                                        isEditing={editingId === task.id}
                                        onSave={(updates) => { updateTask(task.id, updates); setEditingId(null) }}
                                        onCancel={() => setEditingId(null)}
                                        showMoveButtons
                                    />
                                ))}
                                {categorizedTasks.todo.length === 0 && <div className="empty-column"><p>No tasks in To Do</p></div>}
                            </div>
                        )}
                    </div>

                    {/* In Progress */}
                    <div className={`board-column ${collapsed.inProgress ? 'collapsed' : ''}`}>
                        <div className="column-header in-progress" onClick={() => toggleCollapse('inProgress')}>
                            <div className="column-header-left">
                                <CollapseIcon collapsed={collapsed.inProgress} />
                                <h2><InProgressIcon /> In Progress</h2>
                            </div>
                            <span className="column-count">{categorizedTasks.inProgress.length}</span>
                        </div>
                        {!collapsed.inProgress && (
                            <div className="column-content" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'in-progress')}>
                                {categorizedTasks.inProgress.map(task => (
                                    <TaskCard key={task.id} task={task} today={today}
                                        onDragStart={(e) => handleDragStart(e, task)}
                                        onDelete={() => deleteTask(task.id)}
                                        onMoveNext={() => moveTask(task.id, 'done')}
                                        onMoveBack={() => moveTask(task.id, 'todo')}
                                        onEdit={() => setEditingId(task.id)}
                                        isEditing={editingId === task.id}
                                        onSave={(updates) => { updateTask(task.id, updates); setEditingId(null) }}
                                        onCancel={() => setEditingId(null)}
                                        showMoveButtons
                                    />
                                ))}
                                {categorizedTasks.inProgress.length === 0 && <div className="empty-column"><p>No tasks in In Progress</p></div>}
                            </div>
                        )}
                    </div>

                    {/* Done */}
                    <div className={`board-column ${collapsed.done ? 'collapsed' : ''}`}>
                        <div className="column-header done" onClick={() => toggleCollapse('done')}>
                            <div className="column-header-left">
                                <CollapseIcon collapsed={collapsed.done} />
                                <h2><DoneIcon /> Done</h2>
                            </div>
                            <span className="column-count">{categorizedTasks.done.length}</span>
                        </div>
                        {!collapsed.done && (
                            <div className="column-content" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'done')}>
                                {categorizedTasks.done.map(task => (
                                    <TaskCard key={task.id} task={task} today={today}
                                        onDragStart={(e) => handleDragStart(e, task)}
                                        onDelete={() => deleteTask(task.id)}
                                        onMoveBack={() => moveTask(task.id, 'in-progress')}
                                        isCompleted
                                    />
                                ))}
                                {categorizedTasks.done.length === 0 && <div className="empty-column"><p>No tasks in Done</p></div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Task Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add New Task</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><CloseIcon /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="task-form">
                            <div className="form-group">
                                <label>Task Title</label>
                                <input type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="What needs to be done?" autoFocus disabled={isCreating} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Add to</label>
                                    <select value={newTask.status} onChange={(e) => setNewTask({ ...newTask, status: e.target.value })} disabled={isCreating}>
                                        <option value="backlog">Backlog</option>
                                        <option value="todo">Sprint - To Do</option>
                                        <option value="in-progress">Sprint - In Progress</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Priority</label>
                                    <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} disabled={isCreating}>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Due Date (optional)</label>
                                <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} disabled={isCreating} />
                            </div>
                            {newTask.dueDate && (
                                <div className="form-section">
                                    <label className="checkbox-label">
                                        <input type="checkbox" checked={newTask.addToCalendar} onChange={(e) => setNewTask({ ...newTask, addToCalendar: e.target.checked })} disabled={isCreating} />
                                        <span className="checkbox-text"><CalendarPlusIcon /> Add to Google Calendar</span>
                                    </label>
                                </div>
                            )}
                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={isCreating}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={isCreating}>{isCreating ? 'Creating...' : 'Add Task'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function TaskCard({ task, today, onDragStart, onDelete, onMoveToSprint, onMoveNext, onMoveBack, onEdit, isEditing, onSave, onCancel, showMoveButtons, isCompleted }) {
    const [editedTask, setEditedTask] = useState({ title: task.title, priority: task.priority })
    const isOverdue = !task.completed && task.dueDate && task.dueDate < today

    if (isEditing) {
        return (
            <div className="task-card editing">
                <input type="text" value={editedTask.title} onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })} autoFocus className="edit-input" />
                <div className="edit-actions">
                    <select value={editedTask.priority} onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                    <button className="btn btn-primary btn-sm" onClick={() => onSave(editedTask)}>Save</button>
                    <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
                </div>
            </div>
        )
    }

    return (
        <div className={`task-card ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`} draggable onDragStart={onDragStart}>
            <div className="card-content" onClick={onEdit}>
                <span className={`priority-dot ${task.priority}`} />
                <span className="card-title">{task.title}</span>
            </div>
            <div className="card-meta">
                {task.dueDate && <span className={`due-date ${isOverdue ? 'overdue' : ''}`}>{task.dueDate === today ? 'Today' : formatShortDate(task.dueDate)}</span>}
                {task.calendarEventId && <span className="synced-icon">📅</span>}
            </div>
            <div className="card-actions">
                {onMoveToSprint && <button className="btn btn-ghost btn-xs" onClick={onMoveToSprint} title="Move to Sprint"><ArrowRightIcon /></button>}
                {showMoveButtons && onMoveBack && <button className="btn btn-ghost btn-xs" onClick={onMoveBack} title="Move back"><ArrowLeftIcon /></button>}
                {showMoveButtons && onMoveNext && <button className="btn btn-ghost btn-xs" onClick={onMoveNext} title="Move forward"><ArrowRightIcon /></button>}
                {isCompleted && onMoveBack && <button className="btn btn-ghost btn-xs" onClick={onMoveBack} title="Reopen"><UndoIcon /></button>}
                <button className="btn btn-ghost btn-xs delete-btn" onClick={onDelete} title="Delete"><TrashIcon /></button>
            </div>
        </div>
    )
}

// Icons
function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></svg> }
function CloseIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg> }
function ArrowRightIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg> }
function ArrowLeftIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg> }
function UndoIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg> }
function BacklogIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg> }
function TodoIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg> }
function InProgressIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg> }
function DoneIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg> }
function CalendarPlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><line x1="19" x2="19" y1="16" y2="22" /><line x1="16" x2="22" y1="19" y2="19" /></svg> }
function CollapseIcon({ collapsed }) { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}><path d="m6 9 6 6 6-6" /></svg> }

function formatShortDate(dateString) {
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default Tasks
