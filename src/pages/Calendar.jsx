import { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../App'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'
import './Calendar.css'

function Calendar() {
    const { user } = useContext(AuthContext)
    const { calendars, events, fetchCalendars, fetchEvents, toggleCalendar, isLoading } = useGoogleCalendar()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [view, setView] = useState('month') // month, week
    const [selectedDate, setSelectedDate] = useState(null)

    // Fetch calendars on mount
    useEffect(() => {
        fetchCalendars()
    }, [])

    // Fetch events when month changes
    useEffect(() => {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
        fetchEvents(startOfMonth, endOfMonth)
    }, [currentDate, calendars])

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calendar navigation
    const goToPreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }

    const goToToday = () => {
        setCurrentDate(new Date())
        setSelectedDate(null)
    }

    // Generate calendar grid
    const generateCalendarDays = () => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()

        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
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

    const calendarDays = generateCalendarDays()
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    // Get events for selected date
    const selectedEvents = selectedDate
        ? events.filter(e => {
            const eventDate = (e.start?.dateTime || e.start?.date || '').split('T')[0]
            return eventDate === selectedDate
        })
        : []

    return (
        <div className="calendar-page">
            {/* Calendar Main */}
            <div className="calendar-main">
                {/* Header */}
                <header className="calendar-header">
                    <div className="calendar-nav">
                        <button className="btn btn-ghost btn-icon" onClick={goToPreviousMonth}>
                            <ChevronLeft />
                        </button>
                        <h1 className="calendar-title">{monthName}</h1>
                        <button className="btn btn-ghost btn-icon" onClick={goToNextMonth}>
                            <ChevronRight />
                        </button>
                    </div>
                    <div className="calendar-actions">
                        <button className="btn btn-secondary" onClick={goToToday}>Today</button>
                    </div>
                </header>

                {/* Calendar Grid */}
                <div className="calendar-grid">
                    {/* Week Header */}
                    <div className="calendar-weekdays">
                        {weekDays.map(day => (
                            <div key={day} className="weekday">{day}</div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="calendar-days">
                        {calendarDays.map((day, i) => (
                            <button
                                key={i}
                                className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${day.dateStr === selectedDate ? 'selected' : ''}`}
                                onClick={() => setSelectedDate(day.dateStr)}
                            >
                                <span className="day-number">{day.date.getDate()}</span>
                                {day.events.length > 0 && (
                                    <div className="day-events">
                                        {day.events.slice(0, 3).map((event, j) => (
                                            <div
                                                key={j}
                                                className="day-event-dot"
                                                style={{ backgroundColor: event.backgroundColor }}
                                                title={event.summary}
                                            />
                                        ))}
                                        {day.events.length > 3 && (
                                            <span className="more-events">+{day.events.length - 3}</span>
                                        )}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar */}
            <aside className="calendar-sidebar">
                {/* Calendars List */}
                <div className="sidebar-section">
                    <h2 className="sidebar-title">Calendars</h2>
                    {calendars.length === 0 ? (
                        <p className="sidebar-empty">
                            {user?.isDemo ? 'Demo calendars shown' : 'Loading calendars...'}
                        </p>
                    ) : (
                        <div className="calendars-list">
                            {calendars.map(cal => (
                                <label key={cal.id} className="calendar-item">
                                    <input
                                        type="checkbox"
                                        checked={cal.selected}
                                        onChange={() => toggleCalendar(cal.id)}
                                        style={{ accentColor: cal.backgroundColor }}
                                    />
                                    <span
                                        className="calendar-color"
                                        style={{ backgroundColor: cal.backgroundColor }}
                                    />
                                    <span className="calendar-name">{cal.summary}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected Date Events */}
                {selectedDate && (
                    <div className="sidebar-section">
                        <h2 className="sidebar-title">
                            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </h2>
                        {selectedEvents.length === 0 ? (
                            <p className="sidebar-empty">No events</p>
                        ) : (
                            <div className="events-list">
                                {selectedEvents.map((event, i) => (
                                    <div key={i} className="event-card">
                                        <div
                                            className="event-color"
                                            style={{ backgroundColor: event.backgroundColor }}
                                        />
                                        <div className="event-details">
                                            <span className="event-title">{event.summary}</span>
                                            {event.start?.dateTime && (
                                                <span className="event-time">
                                                    {formatTime(event.start.dateTime)}
                                                    {event.end?.dateTime && ` - ${formatTime(event.end.dateTime)}`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Demo Mode Notice */}
                {user?.isDemo && (
                    <div className="sidebar-section demo-notice">
                        <p>📅 Connect Google Calendar in Settings to see your real events.</p>
                    </div>
                )}
            </aside>
        </div>
    )
}

// Icons
function ChevronLeft() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
        </svg>
    )
}

function ChevronRight() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
        </svg>
    )
}

function formatTime(dateTimeStr) {
    const date = new Date(dateTimeStr)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default Calendar
