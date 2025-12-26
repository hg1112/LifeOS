import { useState, useCallback, useEffect, useRef } from 'react'
import { getActiveClientId } from '../utils/clientIdStorage'

// Session duration settings
const TOKEN_TTL_SHORT_MS = 55 * 60 * 1000 // 55 minutes (default, tokens expire in 60 min)
const TOKEN_TTL_LONG_MS = 7 * 24 * 60 * 60 * 1000 // 7 days (Remember Me)
const TOKEN_STORAGE_KEY = 'lifeos-auth'
const REMEMBER_ME_KEY = 'lifeos-remember'

export function useGoogleAuth() {
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [authError, setAuthError] = useState(null)
    const [accessToken, setAccessToken] = useState(null)
    const tokenClientRef = useRef(null)
    const refreshTimeoutRef = useRef(null)

    // Check if "Remember Me" is enabled
    const isRememberMe = useCallback(() => {
        return localStorage.getItem(REMEMBER_ME_KEY) === 'true'
    }, [])

    // Get appropriate TTL based on Remember Me setting
    const getSessionTTL = useCallback(() => {
        return isRememberMe() ? TOKEN_TTL_LONG_MS : TOKEN_TTL_SHORT_MS
    }, [isRememberMe])

    // Load saved session and check token validity
    useEffect(() => {
        const loadSavedSession = async () => {
            try {
                const savedAuth = localStorage.getItem(TOKEN_STORAGE_KEY)
                if (savedAuth) {
                    const authData = JSON.parse(savedAuth)
                    const now = Date.now()

                    // Check if session is still valid
                    if (authData.sessionExpiresAt && authData.sessionExpiresAt > now) {
                        setUser(authData.user)

                        // Check if token is still valid
                        if (authData.tokenExpiresAt && authData.tokenExpiresAt > now) {
                            setAccessToken(authData.token)

                            // Schedule refresh before token expiration
                            const timeUntilRefresh = authData.tokenExpiresAt - now - (5 * 60 * 1000)
                            if (timeUntilRefresh > 0) {
                                scheduleTokenRefresh(timeUntilRefresh)
                            } else {
                                await silentRefresh()
                            }
                        } else {
                            // Token expired but session valid - refresh token
                            await silentRefresh()
                        }
                    } else {
                        // Session expired - clear everything
                        localStorage.removeItem(TOKEN_STORAGE_KEY)
                    }
                }
            } catch (e) {
                console.error('Error loading saved session:', e)
                localStorage.removeItem(TOKEN_STORAGE_KEY)
            }
            setIsLoading(false)
        }

        loadSavedSession()

        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current)
            }
        }
    }, [])

    // Schedule automatic token refresh
    const scheduleTokenRefresh = useCallback((delayMs) => {
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current)
        }

        const minutes = Math.round(delayMs / 60000)
        if (minutes > 0) {
            console.log(`Token refresh scheduled in ${minutes} minutes`)
        }

        refreshTimeoutRef.current = setTimeout(async () => {
            console.log('Refreshing token...')
            await silentRefresh()
        }, Math.max(delayMs, 1000)) // At least 1 second
    }, [])

    // Silent token refresh (no user interaction)
    const silentRefresh = useCallback(async () => {
        const clientId = getActiveClientId()

        if (!clientId) {
            setAuthError('Google Client ID not configured.')
            return
        }

        try {
            await loadGoogleScript()

            // Try to refresh silently using the token client
            if (!tokenClientRef.current) {
                tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: [
                        'https://www.googleapis.com/auth/drive.file',
                        'https://www.googleapis.com/auth/calendar.readonly',
                        'https://www.googleapis.com/auth/calendar.events',
                        'openid',
                        'email',
                        'profile'
                    ].join(' '),
                    prompt: '', // Empty string for silent refresh
                    callback: async (tokenResponse) => {
                        if (tokenResponse.error) {
                            console.error('Token refresh failed:', tokenResponse.error)
                            // Token refresh failed - user needs to sign in again
                            signOut()
                            return
                        }

                        await handleTokenResponse(tokenResponse)
                    }
                })
            }

            tokenClientRef.current.requestAccessToken({ prompt: '' })
        } catch (error) {
            console.error('Silent refresh error:', error)
            setAuthError('Failed to refresh session. Please sign in again.')
        }
    }, [])

    // Handle successful token response
    const handleTokenResponse = useCallback(async (tokenResponse) => {
        const newToken = tokenResponse.access_token
        const tokenExpiresAt = Date.now() + TOKEN_TTL_SHORT_MS // Tokens always expire in ~1 hour
        const sessionTTL = getSessionTTL()

        setAccessToken(newToken)
        setAuthError(null)

        // Get user info if we don't have it
        let currentUser = user
        if (!currentUser) {
            try {
                const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${newToken}` }
                }).then(r => r.json())

                currentUser = {
                    id: userInfo.sub,
                    name: userInfo.name,
                    email: userInfo.email,
                    picture: userInfo.picture
                }
                setUser(currentUser)
            } catch (e) {
                console.error('Error fetching user info:', e)
                setAuthError('Failed to get user information')
                return
            }
        }

        // Save to localStorage
        const savedAuth = localStorage.getItem(TOKEN_STORAGE_KEY)
        const existingSessionExpiry = savedAuth ? JSON.parse(savedAuth).sessionExpiresAt : null

        const authData = {
            user: currentUser,
            token: newToken,
            tokenExpiresAt,
            // Keep existing session expiry if valid, otherwise create new one
            sessionExpiresAt: (existingSessionExpiry && existingSessionExpiry > Date.now())
                ? existingSessionExpiry
                : Date.now() + sessionTTL
        }
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(authData))

        // Schedule next token refresh (5 min before token expiry)
        scheduleTokenRefresh(TOKEN_TTL_SHORT_MS - 5 * 60 * 1000)

        console.log('Token refreshed successfully, session expires:', new Date(authData.sessionExpiresAt).toLocaleString())
    }, [user, scheduleTokenRefresh, getSessionTTL])

    // Sign in with Google
    const signIn = useCallback(async (rememberMe = false) => {
        setIsLoading(true)
        setAuthError(null)

        const clientId = getActiveClientId()

        if (!clientId) {
            setIsLoading(false)
            setAuthError('Google Client ID not configured. Please complete setup.')
            throw new Error('Google Client ID not configured')
        }

        // Save Remember Me preference
        localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false')

        try {
            await loadGoogleScript()

            return new Promise((resolve, reject) => {
                tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: [
                        'https://www.googleapis.com/auth/drive.file',
                        'https://www.googleapis.com/auth/calendar.readonly',
                        'https://www.googleapis.com/auth/calendar.events',
                        'openid',
                        'email',
                        'profile'
                    ].join(' '),
                    callback: async (tokenResponse) => {
                        if (tokenResponse.error) {
                            setIsLoading(false)
                            setAuthError(tokenResponse.error_description || tokenResponse.error)
                            reject(new Error(tokenResponse.error))
                            return
                        }

                        try {
                            await handleTokenResponse(tokenResponse)
                            setIsLoading(false)
                            resolve(user)
                        } catch (e) {
                            setIsLoading(false)
                            setAuthError(e.message)
                            reject(e)
                        }
                    }
                })

                tokenClientRef.current.requestAccessToken()
            })
        } catch (error) {
            console.error('Sign in error:', error)
            setIsLoading(false)
            setAuthError(error.message || 'Failed to sign in')
            throw error
        }
    }, [handleTokenResponse])

    const signOut = useCallback(() => {
        // Clear refresh timer
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current)
        }

        setUser(null)
        setAccessToken(null)
        setAuthError(null)
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(REMEMBER_ME_KEY)
        tokenClientRef.current = null

        // Revoke token if available
        if (accessToken && window.google?.accounts?.oauth2) {
            window.google.accounts.oauth2.revoke(accessToken)
        }
    }, [accessToken])

    const getAccessToken = useCallback(() => {
        // Check if token is still valid
        try {
            const savedAuth = localStorage.getItem(TOKEN_STORAGE_KEY)
            if (savedAuth) {
                const authData = JSON.parse(savedAuth)
                if (authData.tokenExpiresAt && authData.tokenExpiresAt > Date.now()) {
                    return authData.token
                }
            }
        } catch (e) {
            // Ignore errors
        }
        return accessToken
    }, [accessToken])

    // Check if token needs refresh
    const isTokenExpiringSoon = useCallback(() => {
        try {
            const savedAuth = localStorage.getItem(TOKEN_STORAGE_KEY)
            if (savedAuth) {
                const authData = JSON.parse(savedAuth)
                const fiveMinutes = 5 * 60 * 1000
                return authData.tokenExpiresAt && (authData.tokenExpiresAt - Date.now()) < fiveMinutes
            }
        } catch (e) {
            // Ignore
        }
        return false
    }, [])

    // Get session info
    const getSessionInfo = useCallback(() => {
        try {
            const savedAuth = localStorage.getItem(TOKEN_STORAGE_KEY)
            if (savedAuth) {
                const authData = JSON.parse(savedAuth)
                return {
                    sessionExpiresAt: authData.sessionExpiresAt,
                    tokenExpiresAt: authData.tokenExpiresAt,
                    rememberMe: isRememberMe()
                }
            }
        } catch (e) {
            // Ignore
        }
        return null
    }, [isRememberMe])

    return {
        user,
        isLoading,
        authError,
        isAuthenticated: !!user,
        signIn,
        signOut,
        getAccessToken,
        isTokenExpiringSoon,
        refreshToken: silentRefresh,
        getSessionInfo,
        isRememberMe
    }
}

// Helper to load Google Identity Services script
function loadGoogleScript() {
    return new Promise((resolve, reject) => {
        if (window.google?.accounts?.oauth2) {
            resolve()
            return
        }

        const script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.onload = resolve
        script.onerror = () => reject(new Error('Failed to load Google Sign-In'))
        document.head.appendChild(script)
    })
}

export default useGoogleAuth
