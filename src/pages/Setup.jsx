import { useState } from 'react'
import { validateClientIdFormat, saveClientId } from '../utils/clientIdStorage'
import './Setup.css'

function Setup({ onComplete, signIn }) {
    const [clientId, setClientId] = useState('')
    const [username, setUsername] = useState('')
    const [error, setError] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [status, setStatus] = useState('') // 'saving', 'signing-in'

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)

        // Validate username
        if (!username.trim()) {
            setError('Please enter a username')
            return
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
            setError('Username can only contain letters, numbers, underscores, and hyphens')
            return
        }

        // Validate Client ID format
        const validation = validateClientIdFormat(clientId)
        if (!validation.valid) {
            setError(validation.error)
            return
        }

        setIsLoading(true)
        setStatus('saving')

        // Save the Client ID and username
        const saved = saveClientId(clientId.trim(), username.trim().toLowerCase())
        if (!saved) {
            setError('Failed to save. Please try again.')
            setIsLoading(false)
            setStatus('')
            return
        }

        // Auto sign-in with Google
        setStatus('signing-in')
        try {
            await signIn(true) // rememberMe = true
            onComplete()
        } catch (err) {
            // Sign-in failed or was cancelled - still complete setup
            // User can sign in later from Settings
            console.log('Sign-in skipped or failed:', err.message)
            onComplete()
        }
    }

    const getButtonText = () => {
        if (status === 'saving') return 'Saving...'
        if (status === 'signing-in') return 'Signing in with Google...'
        return 'Continue & Sign In'
    }

    return (
        <div className="setup-page">
            <div className="setup-container">
                <div className="setup-header">
                    <div className="setup-logo">🔧</div>
                    <h1>Setup LifeOS</h1>
                    <p>Configure your personal journal</p>
                </div>

                <form className="setup-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Your Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g., harish"
                            disabled={isLoading}
                            autoComplete="off"
                            spellCheck="false"
                        />
                        <span className="form-hint">Used to create your personal folder in Google Drive</span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="clientId">Google OAuth Client ID</label>
                        <input
                            id="clientId"
                            type="text"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            placeholder="xxxxxxxxxx.apps.googleusercontent.com"
                            disabled={isLoading}
                            autoComplete="off"
                            spellCheck="false"
                        />
                        <span className="form-hint">
                            <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
                                Get from Google Cloud Console
                            </a>
                        </span>
                    </div>

                    {error && <p className="form-error">{error}</p>}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={isLoading || !clientId.trim() || !username.trim()}
                    >
                        {getButtonText()}
                    </button>
                </form>

                <div className="setup-note">
                    <p>🔒 Your data is stored locally and in your Google Drive only.</p>
                    <p>We never send it to any server.</p>
                </div>
            </div>
        </div>
    )
}

export default Setup
