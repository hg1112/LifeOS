import { useContext, useState } from 'react'
import { AuthContext } from '../App'
import './Login.css'

function Login() {
    const { signIn, isLoading } = useContext(AuthContext)
    const [error, setError] = useState(null)

    const handleSignIn = async () => {
        setError(null)
        try {
            await signIn()
        } catch (err) {
            setError(err.message || 'Failed to sign in')
        }
    }

    return (
        <div className="login-page">
            <div className="login-container">
                {/* Background decoration */}
                <div className="login-bg-decoration" />

                {/* Logo and branding */}
                <div className="login-header">
                    <div className="login-logo">📓</div>
                    <h1 className="login-title">LifeOS</h1>
                    <p className="login-subtitle">Your personal journaling & productivity companion</p>
                </div>

                {/* Features list */}
                <div className="login-features">
                    <div className="feature-item">
                        <span className="feature-icon">✍️</span>
                        <div className="feature-text">
                            <h3>Daily Journaling</h3>
                            <p>Capture your thoughts in beautiful markdown</p>
                        </div>
                    </div>
                    <div className="feature-item">
                        <span className="feature-icon">✅</span>
                        <div className="feature-text">
                            <h3>Task Management</h3>
                            <p>Stay on top of your priorities</p>
                        </div>
                    </div>
                    <div className="feature-item">
                        <span className="feature-icon">📅</span>
                        <div className="feature-text">
                            <h3>Calendar Sync</h3>
                            <p>View all your events in one place</p>
                        </div>
                    </div>
                    <div className="feature-item">
                        <span className="feature-icon">☁️</span>
                        <div className="feature-text">
                            <h3>Cloud Backup</h3>
                            <p>Your data, safely stored in Google Drive</p>
                        </div>
                    </div>
                </div>

                {/* Sign in button */}
                <div className="login-actions">
                    <button
                        className="btn btn-google"
                        onClick={handleSignIn}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <span className="loading-spinner" />
                                Signing in...
                            </>
                        ) : (
                            <>
                                <GoogleIcon />
                                Continue with Google
                            </>
                        )}
                    </button>

                    {error && (
                        <p className="login-error">{error}</p>
                    )}

                    <p className="login-note">
                        By signing in, you agree to let LifeOS access your Google Drive for data storage
                        and Google Calendar for event sync.
                    </p>
                </div>

                {/* Demo mode link */}
                <div className="login-demo">
                    <button className="btn btn-ghost" onClick={handleSignIn}>
                        Or try Demo Mode →
                    </button>
                </div>
            </div>
        </div>
    )
}

function GoogleIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    )
}

export default Login
