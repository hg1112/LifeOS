// Timezone Storage Utility
const TIMEZONE_KEY = 'lifeos-timezone'
const DEFAULT_TIMEZONE = 'America/Los_Angeles' // PDT/PST

// Common timezones for quick selection
export const COMMON_TIMEZONES = [
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', abbr: 'PDT/PST' },
    { value: 'America/Denver', label: 'Mountain Time (MT)', abbr: 'MDT/MST' },
    { value: 'America/Chicago', label: 'Central Time (CT)', abbr: 'CDT/CST' },
    { value: 'America/New_York', label: 'Eastern Time (ET)', abbr: 'EDT/EST' },
    { value: 'America/Phoenix', label: 'Arizona (no DST)', abbr: 'MST' },
    { value: 'Pacific/Honolulu', label: 'Hawaii', abbr: 'HST' },
    { value: 'America/Anchorage', label: 'Alaska', abbr: 'AKDT/AKST' },
    { value: 'UTC', label: 'UTC', abbr: 'UTC' },
    { value: 'Europe/London', label: 'London', abbr: 'GMT/BST' },
    { value: 'Europe/Paris', label: 'Paris/Berlin', abbr: 'CET/CEST' },
    { value: 'Asia/Tokyo', label: 'Tokyo', abbr: 'JST' },
    { value: 'Asia/Shanghai', label: 'China', abbr: 'CST' },
    { value: 'Asia/Kolkata', label: 'India', abbr: 'IST' },
    { value: 'Australia/Sydney', label: 'Sydney', abbr: 'AEST/AEDT' },
]

// Get stored timezone or default
export function getTimezone() {
    try {
        const stored = localStorage.getItem(TIMEZONE_KEY)
        if (stored && COMMON_TIMEZONES.some(tz => tz.value === stored)) {
            return stored
        }
    } catch (e) {
        console.error('Error reading timezone:', e)
    }
    return DEFAULT_TIMEZONE
}

// Save timezone
export function saveTimezone(timezone) {
    try {
        localStorage.setItem(TIMEZONE_KEY, timezone)
        return true
    } catch (e) {
        console.error('Error saving timezone:', e)
        return false
    }
}

// Get current date in the configured timezone
export function getCurrentDate() {
    const timezone = getTimezone()
    const now = new Date()

    // Format as YYYY-MM-DD in the timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    })

    return formatter.format(now)
}

// Format a date string for display
export function formatDate(dateStr, options = {}) {
    const timezone = getTimezone()
    const date = new Date(dateStr + 'T12:00:00') // Noon to avoid DST issues

    const defaultOptions = {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
    }

    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date)
}

// Format date short (for headers)
export function formatDateShort(dateStr) {
    const timezone = getTimezone()
    const date = new Date(dateStr + 'T12:00:00')

    return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }).format(date)
}

// Get current time in the timezone
export function getCurrentTime(format = '12h') {
    const timezone = getTimezone()
    const now = new Date()

    return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: format === '12h'
    }).format(now)
}

// Get timezone info for display
export function getTimezoneInfo() {
    const timezone = getTimezone()
    const tzInfo = COMMON_TIMEZONES.find(tz => tz.value === timezone)

    if (tzInfo) {
        return tzInfo
    }

    return { value: timezone, label: timezone, abbr: '' }
}

export default {
    getTimezone,
    saveTimezone,
    getCurrentDate,
    formatDate,
    formatDateShort,
    getCurrentTime,
    getTimezoneInfo,
    COMMON_TIMEZONES
}
