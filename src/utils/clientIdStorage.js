// Client ID Storage Utility
// Uses base64 encoding with a salt for basic obfuscation
// Note: This is NOT cryptographically secure - it's obfuscation to prevent casual viewing

const STORAGE_KEY = 'lifeos-config'
const SALT = 'L1f30S_2024'

// Simple encode/decode for obfuscation
function encode(text) {
    if (!text) return ''
    const salted = SALT + text + SALT
    return btoa(salted)
}

function decode(encoded) {
    if (!encoded) return ''
    try {
        const decoded = atob(encoded)
        if (decoded.startsWith(SALT) && decoded.endsWith(SALT)) {
            return decoded.slice(SALT.length, -SALT.length)
        }
        return ''
    } catch {
        return ''
    }
}

// Get stored Client ID
export function getStoredClientId() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const config = JSON.parse(stored)
            return decode(config.cid)
        }
    } catch (e) {
        console.error('Error reading stored config:', e)
    }
    return null
}

// Save Client ID
export function saveClientId(clientId) {
    try {
        const config = {
            cid: encode(clientId),
            savedAt: Date.now()
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
        return true
    } catch (e) {
        console.error('Error saving config:', e)
        return false
    }
}

// Clear stored Client ID
export function clearClientId() {
    localStorage.removeItem(STORAGE_KEY)
}

// Check if Client ID is configured (from env or storage)
export function hasClientId() {
    const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (envClientId && envClientId !== 'YOUR_CLIENT_ID_HERE') {
        return true
    }
    return !!getStoredClientId()
}

// Get active Client ID (env takes priority)
export function getActiveClientId() {
    const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (envClientId && envClientId !== 'YOUR_CLIENT_ID_HERE') {
        return envClientId
    }
    return getStoredClientId()
}

// Validate Client ID format (must end with .apps.googleusercontent.com)
export function validateClientIdFormat(clientId) {
    if (!clientId || typeof clientId !== 'string') {
        return { valid: false, error: 'Client ID is required' }
    }

    const trimmed = clientId.trim()

    if (!trimmed.endsWith('.apps.googleusercontent.com')) {
        return {
            valid: false,
            error: 'Invalid format. Client ID should end with .apps.googleusercontent.com'
        }
    }

    if (trimmed.length < 50) {
        return { valid: false, error: 'Client ID appears too short' }
    }

    return { valid: true, error: null }
}

export default {
    getStoredClientId,
    saveClientId,
    clearClientId,
    hasClientId,
    getActiveClientId,
    validateClientIdFormat
}
