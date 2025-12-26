import { useState, useContext, useMemo, useEffect, useRef } from 'react'
import { DataContext, AuthContext } from '../App'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'
import './Tasks.css'

function Tasks() {
    const { tasks, addTask, updateTask, deleteTask, toggleTask, refreshTasks, tasksDirty, syncStatus } = useContext(DataContext)
    const { user, isAuthenticated } = useContext(AuthContext)
    const { calendars, fetchCalendars, createEvent } = useGoogleCalendar()
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [isCreating, setIsCreating] = useState(false)
    const [draggedTask, setDraggedTask] = useState(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const hasAutoRefreshed = useRef(false)

    // Auto-refresh tasks on page load
    useEffect(() => {
        if (!isAuthenticated || user?.isDemo || hasAutoRefreshed.current) return

        const autoRefresh = async () => {
            setIsRefreshing(true)
            await refreshTasks()
            hasAutoRefreshed.current = true
            setIsRefreshing(false)
        }

        autoRefresh()
    }, [isAuthenticated, user, refreshTasks])

    // Manual refresh handler
    const handleRefresh = async () => {
        setIsRefreshing(true)
        await refreshTasks()
        setIsRefreshing(false)
    }

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
        startTime: '09:00',
        endTime: '10:00',
        isAllDay: true,
        priority: 'medium',
        addToCalendar: false,
        calendarId: 'primary',
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
                let event
                if (newTask.isAllDay) {
                    // All-day event
                    event = {
                        summary: `📋 ${newTask.title}`,
                        description: `Task from LifeOS\nPriority: ${newTask.priority}`,
                        start: { date: newTask.dueDate },
                        end: { date: newTask.dueDate }
                    }
                } else {
                    // Timed event
                    const startDateTime = new Date(`${newTask.dueDate}T${newTask.startTime}:00`)
                    const endDateTime = new Date(`${newTask.dueDate}T${newTask.endTime}:00`)
                    event = {
                        summary: `📋 ${newTask.title}`,
                        description: `Task from LifeOS\nPriority: ${newTask.priority}`,
                        start: { dateTime: startDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                        end: { dateTime: endDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
                    }
                }
                const createdEvent = await createEvent(newTask.calendarId, event)
                calendarEventId = createdEvent?.id
            }

            addTask({
                title: newTask.title.trim(),
                dueDate: newTask.dueDate || null,
                startTime: newTask.isAllDay ? null : newTask.startTime,
                endTime: newTask.isAllDay ? null : newTask.endTime,
                isAllDay: newTask.isAllDay,
                priority: newTask.priority,
                status: newTask.status,
                calendarEventId
            })

            setNewTask({ title: '', dueDate: '', startTime: '09:00', endTime: '10:00', isAllDay: true, priority: 'medium', addToCalendar: false, calendarId: 'primary', status: 'backlog' })
            setShowForm(false)
        } catch (error) {
            console.error('Error:', error)
            addTask({ title: newTask.title.trim(), dueDate: newTask.dueDate || null, priority: newTask.priority, status: newTask.status, isAllDay: true })
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
                    <button
                        className={`btn btn-ghost refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
                        onClick={handleRefresh}
                        disabled={isRefreshing || tasksDirty}
                        title={tasksDirty ? 'Save changes first' : 'Refresh from Drive'}
                    >
                        🔄 {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <span className={`sync-badge ${syncStatus} ${tasksDirty ? 'has-changes' : ''}`}>
                        {isRefreshing ? '🔄' : syncStatus === 'syncing' ? 'Saving...' : tasksDirty ? '●' : '✓'}
                    </span>
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
                                        <option value="high">🔴 High</option>
                                        <option value="medium">🟡 Medium</option>
                                        <option value="low">🔵 Low</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Due Date (optional)</label>
                                <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} disabled={isCreating} />
                            </div>
                            {newTask.dueDate && (
                                <>
                                    <div className="form-group">
                                        <label className="checkbox-label">
                                            <input type="checkbox" checked={newTask.isAllDay} onChange={(e) => setNewTask({ ...newTask, isAllDay: e.target.checked })} disabled={isCreating} />
                                            <span className="checkbox-text">All Day</span>
                                        </label>
                                    </div>
                                    {!newTask.isAllDay && (
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Start Time</label>
                                                <input type="time" value={newTask.startTime} onChange={(e) => setNewTask({ ...newTask, startTime: e.target.value })} disabled={isCreating} />
                                            </div>
                                            <div className="form-group">
                                                <label>End Time</label>
                                                <input type="time" value={newTask.endTime} onChange={(e) => setNewTask({ ...newTask, endTime: e.target.value })} disabled={isCreating} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="form-section">
                                        <label className="checkbox-label">
                                            <input type="checkbox" checked={newTask.addToCalendar} onChange={(e) => setNewTask({ ...newTask, addToCalendar: e.target.checked })} disabled={isCreating} />
                                            <span className="checkbox-text"><CalendarPlusIcon /> Add to Google Calendar</span>
                                        </label>
                                    </div>
                                </>
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
    const [editedTask, setEditedTask] = useState({
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate || '',
        startTime: task.startTime || '09:00',
        endTime: task.endTime || '10:00',
        isAllDay: task.isAllDay ?? true
    })
    const isOverdue = !task.completed && task.dueDate && task.dueDate < today

    // Format time for display
    const formatTime = (time) => {
        if (!time) return ''
        const [hours, mins] = time.split(':')
        const h = parseInt(hours)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const h12 = h % 12 || 12
        return `${h12}:${mins} ${ampm}`
    }

    if (isEditing) {
        return (
            <div className="task-card editing">
                <div className="edit-form">
                    <input
                        type="text"
                        value={editedTask.title}
                        onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                        autoFocus
                        className="edit-input"
                        placeholder="Task title"
                    />

                    <div className="edit-row">
                        <label className="edit-label">Priority</label>
                        <select value={editedTask.priority} onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}>
                            <option value="high">🔴 High</option>
                            <option value="medium">🟡 Medium</option>
                            <option value="low">🔵 Low</option>
                        </select>
                    </div>

                    <div className="edit-row">
                        <label className="edit-label">Due Date</label>
                        <input
                            type="date"
                            value={editedTask.dueDate}
                            onChange={(e) => setEditedTask({ ...editedTask, dueDate: e.target.value })}
                        />
                    </div>

                    {editedTask.dueDate && (
                        <>
                            <div className="edit-row">
                                <label className="checkbox-inline">
                                    <input
                                        type="checkbox"
                                        checked={editedTask.isAllDay}
                                        onChange={(e) => setEditedTask({ ...editedTask, isAllDay: e.target.checked })}
                                    />
                                    <span>All Day</span>
                                </label>
                            </div>

                            {!editedTask.isAllDay && (
                                <div className="edit-row time-row">
                                    <div className="time-input">
                                        <label className="edit-label">Start</label>
                                        <input
                                            type="time"
                                            value={editedTask.startTime}
                                            onChange={(e) => setEditedTask({ ...editedTask, startTime: e.target.value })}
                                        />
                                    </div>
                                    <span className="time-separator">→</span>
                                    <div className="time-input">
                                        <label className="edit-label">End</label>
                                        <input
                                            type="time"
                                            value={editedTask.endTime}
                                            onChange={(e) => setEditedTask({ ...editedTask, endTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="edit-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => onSave(editedTask)}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
                    </div>
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
                {task.dueDate && (
                    <span className={`due-date ${isOverdue ? 'overdue' : ''}`}>
                        {task.dueDate === today ? 'Today' : formatShortDate(task.dueDate)}
                        {!task.isAllDay && task.startTime && (
                            <span className="task-time"> • {formatTime(task.startTime)}</span>
                        )}
                    </span>
                )}
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
