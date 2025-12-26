import { useState, useContext, useMemo, useEffect, useRef } from 'react'
import { DataContext, AuthContext } from '../App'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'
import './Tasks.css'

function Tasks() {
    const { tasks, addTask, updateTask, deleteTask, toggleTask, refreshTasks, tasksDirty, syncStatus } = useContext(DataContext)
    const { user, isAuthenticated } = useContext(AuthContext)
    const { calendars, fetchCalendars, createEvent } = useGoogleCalendar()
    const [showForm, setShowForm] = useState(false)
    const [editingTask, setEditingTask] = useState(null) // Task being edited, or null for new
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

    // Form state for both add and edit
    const [formData, setFormData] = useState({
        title: '',
        description: '',
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

    // Open form for new task or editing
    const handleOpenForm = async (initialStatus = 'backlog', taskToEdit = null) => {
        if (taskToEdit) {
            // Edit mode
            setEditingTask(taskToEdit)
            setFormData({
                title: taskToEdit.title,
                description: taskToEdit.description || '',
                dueDate: taskToEdit.dueDate || '',
                startTime: taskToEdit.startTime || '09:00',
                endTime: taskToEdit.endTime || '10:00',
                isAllDay: taskToEdit.isAllDay ?? true,
                priority: taskToEdit.priority || 'medium',
                status: taskToEdit.status || 'backlog',
                addToCalendar: false,
                calendarId: 'primary'
            })
        } else {
            // New task mode
            setEditingTask(null)
            setFormData({
                title: '',
                description: '',
                dueDate: '',
                startTime: '09:00',
                endTime: '10:00',
                isAllDay: true,
                priority: 'medium',
                status: initialStatus,
                addToCalendar: false,
                calendarId: 'primary'
            })
        }
        setShowForm(true)
        if (calendars.length === 0) await fetchCalendars()
    }

    // Handle clicking on a task card to edit
    const handleEditTask = (task) => {
        handleOpenForm('backlog', task)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.title.trim()) return
        setIsCreating(true)

        try {
            let calendarEventId = editingTask?.calendarEventId || null

            // Create calendar event for new tasks if requested
            if (!editingTask && formData.addToCalendar && formData.dueDate) {
                let event
                if (formData.isAllDay) {
                    event = {
                        summary: `📋 ${formData.title}`,
                        description: `Task from LifeOS\nPriority: ${formData.priority}`,
                        start: { date: formData.dueDate },
                        end: { date: formData.dueDate }
                    }
                } else {
                    const startDateTime = new Date(`${formData.dueDate}T${formData.startTime}:00`)
                    const endDateTime = new Date(`${formData.dueDate}T${formData.endTime}:00`)
                    event = {
                        summary: `📋 ${formData.title}`,
                        description: `Task from LifeOS\nPriority: ${formData.priority}`,
                        start: { dateTime: startDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                        end: { dateTime: endDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
                    }
                }
                const createdEvent = await createEvent(formData.calendarId, event)
                calendarEventId = createdEvent?.id
            }

            if (editingTask) {
                // Update existing task
                updateTask(editingTask.id, {
                    title: formData.title.trim(),
                    description: formData.description.trim(),
                    dueDate: formData.dueDate || null,
                    startTime: formData.isAllDay ? null : formData.startTime,
                    endTime: formData.isAllDay ? null : formData.endTime,
                    isAllDay: formData.isAllDay,
                    priority: formData.priority,
                    status: formData.status
                })
            } else {
                // Create new task
                addTask({
                    title: formData.title.trim(),
                    description: formData.description.trim(),
                    dueDate: formData.dueDate || null,
                    startTime: formData.isAllDay ? null : formData.startTime,
                    endTime: formData.isAllDay ? null : formData.endTime,
                    isAllDay: formData.isAllDay,
                    priority: formData.priority,
                    status: formData.status,
                    calendarEventId
                })
            }

            setShowForm(false)
            setEditingTask(null)
        } catch (error) {
            console.error('Error:', error)
            // Fallback: still create/update without calendar
            if (editingTask) {
                updateTask(editingTask.id, { title: formData.title.trim(), description: formData.description.trim(), priority: formData.priority, status: formData.status })
            } else {
                addTask({ title: formData.title.trim(), description: formData.description.trim(), dueDate: formData.dueDate || null, priority: formData.priority, status: formData.status, isAllDay: true })
            }
            setShowForm(false)
            setEditingTask(null)
        } finally {
            setIsCreating(false)
        }
    }

    const handleCloseForm = () => {
        setShowForm(false)
        setEditingTask(null)
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
                                    onEdit={() => handleEditTask(task)}
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
                                        onEdit={() => handleEditTask(task)}
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
                                        onEdit={() => handleEditTask(task)}
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
                                        onEdit={() => handleEditTask(task)}
                                        isCompleted
                                    />
                                ))}
                                {categorizedTasks.done.length === 0 && <div className="empty-column"><p>No tasks in Done</p></div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Task Form Modal (Add/Edit) */}
            {showForm && (
                <div className="modal-overlay" onClick={handleCloseForm}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingTask ? 'Edit Task' : 'Add New Task'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={handleCloseForm}><CloseIcon /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="task-form">
                            <div className="form-group">
                                <label>Task Title</label>
                                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="What needs to be done?" autoFocus disabled={isCreating} />
                            </div>
                            <div className="form-group">
                                <label>Description (optional)</label>
                                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Add more details..." rows={3} disabled={isCreating} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Status</label>
                                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} disabled={isCreating}>
                                        <option value="backlog">Backlog</option>
                                        <option value="todo">Sprint - To Do</option>
                                        <option value="in-progress">Sprint - In Progress</option>
                                        <option value="done">Done</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Priority</label>
                                    <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} disabled={isCreating}>
                                        <option value="high">🔴 High</option>
                                        <option value="medium">🟡 Medium</option>
                                        <option value="low">🔵 Low</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Due Date (optional)</label>
                                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} disabled={isCreating} />
                            </div>
                            {formData.dueDate && (
                                <>
                                    <div className="form-group">
                                        <label className="checkbox-label">
                                            <input type="checkbox" checked={formData.isAllDay} onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })} disabled={isCreating} />
                                            <span className="checkbox-text">All Day</span>
                                        </label>
                                    </div>
                                    {!formData.isAllDay && (
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Start Time</label>
                                                <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} disabled={isCreating} />
                                            </div>
                                            <div className="form-group">
                                                <label>End Time</label>
                                                <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} disabled={isCreating} />
                                            </div>
                                        </div>
                                    )}
                                    {!editingTask && (
                                        <div className="form-section">
                                            <label className="checkbox-label">
                                                <input type="checkbox" checked={formData.addToCalendar} onChange={(e) => setFormData({ ...formData, addToCalendar: e.target.checked })} disabled={isCreating} />
                                                <span className="checkbox-text"><CalendarPlusIcon /> Add to Google Calendar</span>
                                            </label>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseForm} disabled={isCreating}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={isCreating}>
                                    {isCreating ? (editingTask ? 'Saving...' : 'Creating...') : (editingTask ? 'Save Changes' : 'Add Task')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function TaskCard({ task, today, onDragStart, onDelete, onMoveToSprint, onMoveNext, onMoveBack, onEdit, showMoveButtons, isCompleted }) {
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

    return (
        <div className={`task-card ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`} draggable onDragStart={onDragStart}>
            <div className="card-content" onClick={onEdit} title="Click to edit">
                <span className={`priority-dot ${task.priority}`} />
                <div className="card-text">
                    <span className="card-title">{task.title}</span>
                    {task.description && (
                        <span className="card-description">{task.description.slice(0, 60)}{task.description.length > 60 ? '...' : ''}</span>
                    )}
                </div>
                {task.description && <span className="has-description" title="Has description">📝</span>}
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
                <button className="btn btn-ghost btn-xs" onClick={onEdit} title="Edit task"><EditIcon /></button>
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
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> }
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
