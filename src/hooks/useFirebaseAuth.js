import { useState, useCallback, useEffect, useRef } from 'react'
import {
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    browserLocalPersistence,
    setPersistence
} from 'firebase/auth'
import { auth } from '../utils/firebase'

// Google OAuth scopes for Drive and Calendar access
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
]

export function useFirebaseAuth() {
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [authError, setAuthError] = useState(null)
    const [accessToken, setAccessToken] = useState(null)
    const providerRef = useRef(null)

    // Initialize Google Auth Provider with scopes
    useEffect(() => {
        providerRef.current = new GoogleAuthProvider()
        // Add Drive and Calendar scopes
        SCOPES.forEach(scope => providerRef.current.addScope(scope))
        // Force account selection on sign-in
        providerRef.current.setCustomParameters({
            prompt: 'select_account'
        })
    }, [])

    // Listen for auth state changes (this is what makes sessions persist!)
    useEffect(() => {
        // Set persistence to LOCAL (survives browser restart)
        setPersistence(auth, browserLocalPersistence)
            .then(() => {
                console.log('Firebase persistence set to LOCAL')
            })
            .catch(err => {
                console.error('Error setting persistence:', err)
            })

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // User is signed in
                const userData = {
                    id: firebaseUser.uid,
                    name: firebaseUser.displayName,
                    email: firebaseUser.email,
                    picture: firebaseUser.photoURL
                }
                setUser(userData)

                // Get OAuth access token for Google APIs
                try {
                    // Get the credential from the user
                    const credential = GoogleAuthProvider.credentialFromResult
                    // For returning users, we need to get a fresh token
                    const token = await getGoogleAccessToken(firebaseUser)
                    if (token) {
                        setAccessToken(token)
                    }
                } catch (e) {
                    console.log('Will get token on next interaction')
                }
            } else {
                // User is signed out
                setUser(null)
                setAccessToken(null)
            }
            setIsLoading(false)
        })

        return () => unsubscribe()
    }, [])

    // Get Google access token for Drive/Calendar APIs
    const getGoogleAccessToken = async (firebaseUser) => {
        try {
            // For Firebase Auth with Google, we can get the access token
            // by checking if there's a cached credential
            const savedToken = sessionStorage.getItem('google_access_token')
            const savedExpiry = sessionStorage.getItem('google_token_expiry')

            if (savedToken && savedExpiry && Date.now() < parseInt(savedExpiry)) {
                return savedToken
            }

            return null
        } catch (e) {
            console.error('Error getting access token:', e)
            return null
        }
    }

    // Sign in with Google
    const signIn = useCallback(async () => {
        setIsLoading(true)
        setAuthError(null)

        try {
            const result = await signInWithPopup(auth, providerRef.current)

            // Get the Google OAuth access token
            const credential = GoogleAuthProvider.credentialFromResult(result)
            const token = credential?.accessToken

            if (token) {
                setAccessToken(token)
                // Cache the token (tokens last ~1 hour)
                sessionStorage.setItem('google_access_token', token)
                sessionStorage.setItem('google_token_expiry', String(Date.now() + 55 * 60 * 1000))
            }

            const userData = {
                id: result.user.uid,
                name: result.user.displayName,
                email: result.user.email,
                picture: result.user.photoURL
            }
            setUser(userData)
            setIsLoading(false)

            return userData
        } catch (error) {
            console.error('Sign in error:', error)
            setIsLoading(false)

            if (error.code === 'auth/popup-closed-by-user') {
                setAuthError('Sign-in cancelled')
            } else if (error.code === 'auth/popup-blocked') {
                setAuthError('Popup blocked. Please allow popups for this site.')
            } else {
                setAuthError(error.message || 'Failed to sign in')
            }
            throw error
        }
    }, [])

    // Sign out
    const signOut = useCallback(async () => {
        try {
            await firebaseSignOut(auth)
            setUser(null)
            setAccessToken(null)
            sessionStorage.removeItem('google_access_token')
            sessionStorage.removeItem('google_token_expiry')
        } catch (error) {
            console.error('Sign out error:', error)
            setAuthError(error.message)
        }
    }, [])

    // Get current access token (synchronous - returns cached token)
    // This is used by useGoogleDrive which expects sync access
    const getAccessToken = useCallback(() => {
        // Check cached token first
        const savedToken = sessionStorage.getItem('google_access_token')
        const savedExpiry = sessionStorage.getItem('google_token_expiry')

        if (savedToken && savedExpiry && Date.now() < parseInt(savedExpiry)) {
            return savedToken
        }

        // Token expired or not available - return current state token if we have it
        return accessToken
    }, [accessToken])

    // Async version that will re-auth if needed
    const refreshAccessToken = useCallback(async () => {
        // Check cached token first
        const savedToken = sessionStorage.getItem('google_access_token')
        const savedExpiry = sessionStorage.getItem('google_token_expiry')

        if (savedToken && savedExpiry && Date.now() < parseInt(savedExpiry)) {
            return savedToken
        }

        // Token expired or missing - need to re-auth to get new token
        if (user) {
            try {
                // Re-auth with popup
                const result = await signInWithPopup(auth, providerRef.current)
                const credential = GoogleAuthProvider.credentialFromResult(result)
                const token = credential?.accessToken

                if (token) {
                    setAccessToken(token)
                    sessionStorage.setItem('google_access_token', token)
                    sessionStorage.setItem('google_token_expiry', String(Date.now() + 55 * 60 * 1000))
                    return token
                }
            } catch (e) {
                console.error('Token refresh failed:', e)
            }
        }

        return accessToken
    }, [user, accessToken])

    // Check if user is authenticated
    const isAuthenticated = !!user

    return {
        user,
        isLoading,
        isAuthenticated,
        authError,
        signIn,
        signOut,
        getAccessToken,      // Synchronous - returns cached token
        refreshAccessToken,  // Async - will re-auth if needed
        accessToken
    }
}
