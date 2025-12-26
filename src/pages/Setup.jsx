import { useState } from 'react'
import { validateClientIdFormat, saveClientId } from '../utils/clientIdStorage'
import './Setup.css'

function Setup({ onComplete, signIn }) {
    const [clientId, setClientId] = useState('')
    const [error, setError] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [status, setStatus] = useState('') // 'saving', 'signing-in'

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)

        // Validate format
        const validation = validateClientIdFormat(clientId)
        if (!validation.valid) {
            setError(validation.error)
            return
        }

        setIsLoading(true)
        setStatus('saving')

        // Save the Client ID
        const saved = saveClientId(clientId.trim())
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
                    <p>Bring Your Own Google Client ID</p>
                </div>

                <div className="setup-instructions">
                    <h2>How to get your Client ID:</h2>
                    <ol>
                        <li>
                            Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>
                        </li>
                        <li>Create a new project (or select existing)</li>
                        <li>
                            Enable these APIs:
                            <ul>
                                <li>Google Drive API</li>
                                <li>Google Calendar API</li>
                            </ul>
                        </li>
                        <li>Go to <strong>Credentials</strong> → <strong>Create Credentials</strong> → <strong>OAuth client ID</strong></li>
                        <li>Choose <strong>Web application</strong></li>
                        <li>
                            Add <strong>Authorized JavaScript origins</strong>:
                            <code>{window.location.origin}</code>
                        </li>
                        <li>Copy the <strong>Client ID</strong> and paste below</li>
                    </ol>
                </div>

                <form className="setup-form" onSubmit={handleSubmit}>
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
                        {error && <p className="form-error">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={isLoading || !clientId.trim()}
                    >
                        {getButtonText()}
                    </button>
                </form>

                <div className="setup-note">
                    <p>🔒 Your Client ID is stored locally on this device only.</p>
                    <p>We never send it to any server.</p>
                </div>
            </div>
        </div>
    )
}

export default Setup
