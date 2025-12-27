import { useState, useCallback, useContext } from 'react'
import { AuthContext } from '../App'

export function useGoogleCalendar() {
    const { getAccessToken, user } = useContext(AuthContext)
    const [calendars, setCalendars] = useState([])
    const [events, setEvents] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    // Fetch all calendars (including shared ones)
    const fetchCalendars = useCallback(async () => {
        if (user?.isDemo) {
            // Return demo calendars
            const demoCalendars = [
                { id: 'primary', summary: 'My Calendar', backgroundColor: '#6366f1', selected: true },
                { id: 'work', summary: 'Work', backgroundColor: '#10b981', selected: true },
                { id: 'personal', summary: 'Personal', backgroundColor: '#f59e0b', selected: false }
            ]
            setCalendars(demoCalendars)
            return demoCalendars
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch(
                'https://www.googleapis.com/calendar/v3/users/me/calendarList',
                { headers: { Authorization: `Bearer ${token}` } }
            )

            if (!response.ok) throw new Error('Failed to fetch calendars')
            const data = await response.json()

            const calendarList = (data.items || []).map(cal => ({
                id: cal.id,
                summary: cal.summary,
                backgroundColor: cal.backgroundColor || '#6366f1',
                selected: cal.selected !== false,
                accessRole: cal.accessRole
            }))

            setCalendars(calendarList)
            setIsLoading(false)
            return calendarList
        } catch (err) {
            setError(err.message)
            setIsLoading(false)
            throw err
        }
    }, [getAccessToken, user])

    // Fetch events for a date range
    const fetchEvents = useCallback(async (startDate, endDate, calendarIds = null) => {
        if (user?.isDemo) {
            // Return demo events
            const today = new Date()
            const demoEvents = [
                {
                    id: '1',
                    summary: 'Team Standup',
                    start: { dateTime: new Date(today.setHours(9, 0, 0, 0)).toISOString() },
                    end: { dateTime: new Date(today.setHours(9, 30, 0, 0)).toISOString() },
                    calendarId: 'work',
                    backgroundColor: '#10b981'
                },
                {
                    id: '2',
                    summary: 'Project Review',
                    start: { dateTime: new Date(today.setHours(14, 0, 0, 0)).toISOString() },
                    end: { dateTime: new Date(today.setHours(15, 0, 0, 0)).toISOString() },
                    calendarId: 'work',
                    backgroundColor: '#10b981'
                },
                {
                    id: '3',
                    summary: 'Gym Session',
                    start: { dateTime: new Date(today.setHours(18, 0, 0, 0)).toISOString() },
                    end: { dateTime: new Date(today.setHours(19, 0, 0, 0)).toISOString() },
                    calendarId: 'personal',
                    backgroundColor: '#f59e0b'
                }
            ]
            setEvents(demoEvents)
            return demoEvents
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        setIsLoading(true)
        setError(null)

        try {
            const selectedCalendars = calendarIds || calendars.filter(c => c.selected).map(c => c.id)

            // Fetch events from each selected calendar
            const allEvents = []

            for (const calId of selectedCalendars) {
                const cal = calendars.find(c => c.id === calId)
                const params = new URLSearchParams({
                    timeMin: startDate.toISOString(),
                    timeMax: endDate.toISOString(),
                    singleEvents: 'true',
                    orderBy: 'startTime',
                    maxResults: '100'
                })

                const response = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                )

                if (response.ok) {
                    const data = await response.json()
                    const calEvents = (data.items || []).map(event => ({
                        ...event,
                        calendarId: calId,
                        backgroundColor: cal?.backgroundColor || '#6366f1'
                    }))
                    allEvents.push(...calEvents)
                }
            }

            // Sort by start time
            allEvents.sort((a, b) => {
                const aStart = a.start?.dateTime || a.start?.date
                const bStart = b.start?.dateTime || b.start?.date
                return new Date(aStart) - new Date(bStart)
            })

            setEvents(allEvents)
            setIsLoading(false)
            return allEvents
        } catch (err) {
            setError(err.message)
            setIsLoading(false)
            throw err
        }
    }, [getAccessToken, user, calendars])

    // Create a new event
    const createEvent = useCallback(async (calendarId, event) => {
        if (user?.isDemo) {
            console.log('Demo mode - event creation simulated')
            return { id: `demo-${Date.now()}`, ...event }
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            }
        )

        if (!response.ok) throw new Error('Failed to create event')
        return await response.json()
    }, [getAccessToken, user])

    // Update an event
    const updateEvent = useCallback(async (calendarId, eventId, event) => {
        if (user?.isDemo) {
            console.log('Demo mode - event update simulated')
            return event
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            }
        )

        if (!response.ok) throw new Error('Failed to update event')
        return await response.json()
    }, [getAccessToken, user])

    // Delete an event
    const deleteEvent = useCallback(async (calendarId, eventId) => {
        if (user?.isDemo) {
            console.log('Demo mode - event deletion simulated')
            return
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
            {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            }
        )

        if (!response.ok) throw new Error('Failed to delete event')
    }, [getAccessToken, user])

    // Toggle calendar selection
    const toggleCalendar = useCallback((calendarId) => {
        setCalendars(prev => prev.map(cal =>
            cal.id === calendarId ? { ...cal, selected: !cal.selected } : cal
        ))
    }, [])

    return {
        calendars,
        events,
        isLoading,
        error,
        fetchCalendars,
        fetchEvents,
        createEvent,
        updateEvent,
        deleteEvent,
        toggleCalendar
    }
}

export default useGoogleCalendar
