import { useState, useCallback, useEffect, useRef } from 'react'

// Token refresh settings
const TOKEN_TTL_MS = 55 * 60 * 1000 // 55 minutes (tokens expire in 60 min)
const TOKEN_STORAGE_KEY = 'lifeos-auth'

export function useGoogleAuth() {
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [accessToken, setAccessToken] = useState(null)
    const tokenClientRef = useRef(null)
    const refreshTimeoutRef = useRef(null)

    // Load saved session and check token validity
    useEffect(() => {
        const loadSavedSession = async () => {
            try {
                const savedAuth = localStorage.getItem(TOKEN_STORAGE_KEY)
                if (savedAuth) {
                    const authData = JSON.parse(savedAuth)
                    const now = Date.now()

                    // Check if token is still valid
                    if (authData.expiresAt && authData.expiresAt > now) {
                        setUser(authData.user)
                        setAccessToken(authData.token)

                        // Schedule refresh before expiration
                        const timeUntilRefresh = authData.expiresAt - now - (5 * 60 * 1000) // 5 min before expiry
                        if (timeUntilRefresh > 0) {
                            scheduleTokenRefresh(timeUntilRefresh)
                        } else {
                            // Token expiring soon, refresh now
                            await silentRefresh()
                        }
                    } else if (authData.user) {
                        // Token expired but we have user info - try silent refresh
                        setUser(authData.user)
                        await silentRefresh()
                    } else {
                        // Clear invalid data
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

        console.log(`Token refresh scheduled in ${Math.round(delayMs / 60000)} minutes`)

        refreshTimeoutRef.current = setTimeout(async () => {
            console.log('Refreshing token...')
            await silentRefresh()
        }, delayMs)
    }, [])

    // Silent token refresh (no user interaction)
    const silentRefresh = useCallback(async () => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

        if (!clientId || clientId === 'YOUR_CLIENT_ID_HERE') {
            // Demo mode - just extend the session
            const savedAuth = localStorage.getItem(TOKEN_STORAGE_KEY)
            if (savedAuth) {
                const authData = JSON.parse(savedAuth)
                if (authData.user?.isDemo) {
                    authData.expiresAt = Date.now() + TOKEN_TTL_MS
                    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(authData))
                    scheduleTokenRefresh(TOKEN_TTL_MS - 5 * 60 * 1000)
                    return
                }
            }
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
        }
    }, [])

    // Handle successful token response
    const handleTokenResponse = useCallback(async (tokenResponse) => {
        const newToken = tokenResponse.access_token
        const expiresAt = Date.now() + TOKEN_TTL_MS

        setAccessToken(newToken)

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
                    picture: userInfo.picture,
                    isDemo: false
                }
                setUser(currentUser)
            } catch (e) {
                console.error('Error fetching user info:', e)
                return
            }
        }

        // Save to localStorage with TTL
        const authData = {
            user: currentUser,
            token: newToken,
            expiresAt
        }
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(authData))

        // Schedule next refresh
        scheduleTokenRefresh(TOKEN_TTL_MS - 5 * 60 * 1000)

        console.log('Token refreshed successfully, expires at:', new Date(expiresAt).toLocaleTimeString())
    }, [user, scheduleTokenRefresh])

    const signIn = useCallback(async () => {
        setIsLoading(true)

        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

        if (!clientId || clientId === 'YOUR_CLIENT_ID_HERE') {
            // Demo mode
            console.log('Google Client ID not configured - using demo mode')
            const demoUser = {
                id: 'demo-user',
                name: 'Demo User',
                email: 'demo@lifeos.app',
                picture: null,
                isDemo: true
            }

            const authData = {
                user: demoUser,
                token: 'demo-token',
                expiresAt: Date.now() + TOKEN_TTL_MS
            }

            setUser(demoUser)
            setAccessToken('demo-token')
            localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(authData))
            scheduleTokenRefresh(TOKEN_TTL_MS - 5 * 60 * 1000)
            setIsLoading(false)
            return demoUser
        }

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
                            reject(new Error(tokenResponse.error))
                            return
                        }

                        try {
                            await handleTokenResponse(tokenResponse)
                            setIsLoading(false)
                            resolve(user)
                        } catch (e) {
                            setIsLoading(false)
                            reject(e)
                        }
                    }
                })

                tokenClientRef.current.requestAccessToken()
            })
        } catch (error) {
            console.error('Sign in error:', error)
            setIsLoading(false)
            throw error
        }
    }, [handleTokenResponse, scheduleTokenRefresh])

    const signOut = useCallback(() => {
        // Clear refresh timer
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current)
        }

        setUser(null)
        setAccessToken(null)
        localStorage.removeItem(TOKEN_STORAGE_KEY)
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
                if (authData.expiresAt && authData.expiresAt > Date.now()) {
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
                return authData.expiresAt && (authData.expiresAt - Date.now()) < fiveMinutes
            }
        } catch (e) {
            // Ignore
        }
        return false
    }, [])

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signOut,
        getAccessToken,
        isTokenExpiringSoon,
        refreshToken: silentRefresh
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
        script.onerror = reject
        document.head.appendChild(script)
    })
}

export default useGoogleAuth
