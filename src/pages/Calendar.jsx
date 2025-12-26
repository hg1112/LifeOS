import { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../App'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'
import './Calendar.css'

function Calendar() {
    const { user } = useContext(AuthContext)
    const { calendars, events, fetchCalendars, fetchEvents, toggleCalendar, isLoading } = useGoogleCalendar()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [view, setView] = useState('month') // month, week, day
    const [selectedDate, setSelectedDate] = useState(null)

    // Fetch calendars on mount
    useEffect(() => {
        fetchCalendars()
    }, [])

    // Fetch events when date or view changes
    useEffect(() => {
        let startDate, endDate
        if (view === 'day') {
            startDate = new Date(currentDate)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(currentDate)
            endDate.setHours(23, 59, 59, 999)
        } else if (view === 'week') {
            startDate = getWeekStart(currentDate)
            endDate = new Date(startDate)
            endDate.setDate(endDate.getDate() + 6)
            endDate.setHours(23, 59, 59, 999)
        } else {
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
            endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
        }
        fetchEvents(startDate, endDate)
    }, [currentDate, view, calendars])

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    function getWeekStart(date) {
        const d = new Date(date)
        d.setDate(d.getDate() - d.getDay())
        d.setHours(0, 0, 0, 0)
        return d
    }

    const goToPrevious = () => {
        const newDate = new Date(currentDate)
        if (view === 'day') newDate.setDate(newDate.getDate() - 1)
        else if (view === 'week') newDate.setDate(newDate.getDate() - 7)
        else newDate.setMonth(newDate.getMonth() - 1)
        setCurrentDate(newDate)
    }

    const goToNext = () => {
        const newDate = new Date(currentDate)
        if (view === 'day') newDate.setDate(newDate.getDate() + 1)
        else if (view === 'week') newDate.setDate(newDate.getDate() + 7)
        else newDate.setMonth(newDate.getMonth() + 1)
        setCurrentDate(newDate)
    }

    const goToToday = () => {
        setCurrentDate(new Date())
        setSelectedDate(null)
    }

    const getTitle = () => {
        if (view === 'day') {
            return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        } else if (view === 'week') {
            const weekStart = getWeekStart(currentDate)
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 6)
            return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        }
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }

    const generateCalendarDays = () => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const startDate = new Date(firstDay)
        startDate.setDate(startDate.getDate() - firstDay.getDay())

        const days = []
        const current = new Date(startDate)

        for (let i = 0; i < 42; i++) {
            const dateStr = current.toISOString().split('T')[0]
            const dayEvents = events.filter(e => {
                const eventDate = (e.start?.dateTime || e.start?.date || '').split('T')[0]
                return eventDate === dateStr
            })
            days.push({
                date: new Date(current),
                dateStr,
                isCurrentMonth: current.getMonth() === month,
                isToday: current.toDateString() === today.toDateString(),
                events: dayEvents
            })
            current.setDate(current.getDate() + 1)
        }
        return days
    }

    const generateWeekDays = () => {
        const weekStart = getWeekStart(currentDate)
        const days = []
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart)
            date.setDate(date.getDate() + i)
            const dateStr = date.toISOString().split('T')[0]
            const dayEvents = events.filter(e => {
                const eventDate = (e.start?.dateTime || e.start?.date || '').split('T')[0]
                return eventDate === dateStr
            })
            days.push({ date, dateStr, events: dayEvents, isToday: date.toDateString() === today.toDateString() })
        }
        return days
    }

    const getDayEvents = () => {
        const dateStr = currentDate.toISOString().split('T')[0]
        return events.filter(e => {
            const eventDate = (e.start?.dateTime || e.start?.date || '').split('T')[0]
            return eventDate === dateStr
        })
    }

    const handleDayClick = (dateStr) => {
        setSelectedDate(dateStr)
        setCurrentDate(new Date(dateStr + 'T12:00:00'))
        setView('day')
    }

    const calendarDays = generateCalendarDays()
    const weekDays = generateWeekDays()
    const dayEvents = getDayEvents()
    const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const hours = Array.from({ length: 24 }, (_, i) => i)

    const selectedEvents = selectedDate
        ? events.filter(e => (e.start?.dateTime || e.start?.date || '').split('T')[0] === selectedDate)
        : []

    return (
        <div className="calendar-page">
            <div className="calendar-main">
                <header className="calendar-header">
                    <div className="calendar-nav">
                        <button className="btn btn-ghost btn-icon" onClick={goToPrevious}><ChevronLeft /></button>
                        <h1 className="calendar-title">{getTitle()}</h1>
                        <button className="btn btn-ghost btn-icon" onClick={goToNext}><ChevronRight /></button>
                    </div>
                    <div className="calendar-actions">
                        <button className="btn btn-secondary" onClick={goToToday}>Today</button>
                        <div className="view-toggle">
                            <button className={`view-btn ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')}>Day</button>
                            <button className={`view-btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Week</button>
                            <button className={`view-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Month</button>
                        </div>
                    </div>
                </header>

                {/* Day View */}
                {view === 'day' && (
                    <div className="day-view">
                        {dayEvents.filter(e => !e.start?.dateTime).length > 0 && (
                            <div className="all-day-section">
                                <span className="all-day-label">All Day</span>
                                <div className="all-day-events">
                                    {dayEvents.filter(e => !e.start?.dateTime).map((event, i) => (
                                        <div key={i} className="all-day-event" style={{ backgroundColor: event.backgroundColor }}>{event.summary}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="day-timeline">
                            {hours.map(hour => (
                                <div key={hour} className="hour-row">
                                    <div className="hour-label">{hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}</div>
                                    <div className="hour-content">
                                        {dayEvents.filter(e => e.start?.dateTime && new Date(e.start.dateTime).getHours() === hour).map((event, i) => (
                                            <div key={i} className="timeline-event" style={{ backgroundColor: event.backgroundColor }}>
                                                <span className="event-time">{formatTime(event.start.dateTime)}</span>
                                                <span className="event-title">{event.summary}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Week View */}
                {view === 'week' && (
                    <div className="week-view">
                        <div className="week-header">
                            {weekDays.map((day, i) => (
                                <div key={i} className={`week-day-header ${day.isToday ? 'today' : ''}`} onClick={() => handleDayClick(day.dateStr)}>
                                    <span className="weekday-name">{weekDayNames[i]}</span>
                                    <span className="weekday-date">{day.date.getDate()}</span>
                                </div>
                            ))}
                        </div>
                        <div className="week-grid">
                            {weekDays.map((day, i) => (
                                <div key={i} className={`week-day-column ${day.isToday ? 'today' : ''}`} onClick={() => handleDayClick(day.dateStr)}>
                                    {day.events.map((event, j) => (
                                        <div key={j} className="week-event" style={{ backgroundColor: event.backgroundColor }}>
                                            {event.start?.dateTime && <span className="event-time">{formatTime(event.start.dateTime)}</span>}
                                            <span className="event-title">{event.summary}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Month View */}
                {view === 'month' && (
                    <div className="calendar-grid">
                        <div className="calendar-weekdays">
                            {weekDayNames.map(day => (<div key={day} className="weekday">{day}</div>))}
                        </div>
                        <div className="calendar-days">
                            {calendarDays.map((day, i) => (
                                <button key={i} className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${day.dateStr === selectedDate ? 'selected' : ''}`} onClick={() => handleDayClick(day.dateStr)}>
                                    <span className="day-number">{day.date.getDate()}</span>
                                    {day.events.length > 0 && (
                                        <div className="day-events">
                                            {day.events.slice(0, 3).map((event, j) => (<div key={j} className="day-event-dot" style={{ backgroundColor: event.backgroundColor }} title={event.summary} />))}
                                            {day.events.length > 3 && <span className="more-events">+{day.events.length - 3}</span>}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <aside className="calendar-sidebar">
                <div className="sidebar-section">
                    <h2 className="sidebar-title">Calendars</h2>
                    {calendars.length === 0 ? (
                        <p className="sidebar-empty">{user?.isDemo ? 'Demo calendars shown' : 'Loading calendars...'}</p>
                    ) : (
                        <div className="calendars-list">
                            {calendars.map(cal => (
                                <label key={cal.id} className="calendar-item">
                                    <input type="checkbox" checked={cal.selected} onChange={() => toggleCalendar(cal.id)} style={{ accentColor: cal.backgroundColor }} />
                                    <span className="calendar-color" style={{ backgroundColor: cal.backgroundColor }} />
                                    <span className="calendar-name">{cal.summary}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {view === 'month' && selectedDate && (
                    <div className="sidebar-section">
                        <h2 className="sidebar-title">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                        {selectedEvents.length === 0 ? (
                            <p className="sidebar-empty">No events</p>
                        ) : (
                            <div className="events-list">
                                {selectedEvents.map((event, i) => (
                                    <div key={i} className="event-card">
                                        <div className="event-color" style={{ backgroundColor: event.backgroundColor }} />
                                        <div className="event-details">
                                            <span className="event-title">{event.summary}</span>
                                            {event.start?.dateTime && <span className="event-time">{formatTime(event.start.dateTime)}{event.end?.dateTime && ` - ${formatTime(event.end.dateTime)}`}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {user?.isDemo && (
                    <div className="sidebar-section demo-notice">
                        <p>📅 Connect Google Calendar in Settings to see your real events.</p>
                    </div>
                )}
            </aside>
        </div>
    )
}

function ChevronLeft() {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
}

function ChevronRight() {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
}

function formatTime(dateTimeStr) {
    const date = new Date(dateTimeStr)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default Calendar
