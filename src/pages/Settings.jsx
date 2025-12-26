import { useContext, useState } from 'react'
import { ThemeContext, AuthContext } from '../App'
import { getTimezone, saveTimezone, COMMON_TIMEZONES } from '../utils/timezone'
import './Settings.css'

function Settings() {
    const { theme, toggleTheme } = useContext(ThemeContext)
    const { user, signOut, signIn } = useContext(AuthContext)
    const [timezone, setTimezone] = useState(getTimezone)

    const handleTimezoneChange = (e) => {
        const newTimezone = e.target.value
        setTimezone(newTimezone)
        saveTimezone(newTimezone)
    }

    return (
        <div className="settings-page">
            <header className="settings-header">
                <h1>Settings</h1>
            </header>

            <div className="settings-content">
                {/* Account Section */}
                <section className="settings-section">
                    <h2 className="section-title">Account</h2>

                    <div className="settings-card">
                        {user ? (
                            <div className="account-info">
                                <div className="account-avatar">
                                    {user.picture ? (
                                        <img src={user.picture} alt={user.name} />
                                    ) : (
                                        <span>{user.name?.charAt(0) || '?'}</span>
                                    )}
                                </div>
                                <div className="account-details">
                                    <span className="account-name">{user.name}</span>
                                    <span className="account-email">{user.email}</span>
                                    {user.isDemo && (
                                        <span className="demo-badge">Demo Mode</span>
                                    )}
                                </div>
                                <button className="btn btn-secondary" onClick={signOut}>
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <div className="account-login">
                                <p>Sign in to sync your data across devices</p>
                                <button className="btn btn-primary" onClick={signIn}>
                                    Sign in with Google
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Appearance Section */}
                <section className="settings-section">
                    <h2 className="section-title">Appearance</h2>

                    <div className="settings-card">
                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Theme</span>
                                <span className="setting-description">Choose your preferred color scheme</span>
                            </div>
                            <div className="theme-switcher">
                                <button
                                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                                    onClick={() => theme === 'dark' && toggleTheme()}
                                >
                                    <SunIcon />
                                    Light
                                </button>
                                <button
                                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => theme === 'light' && toggleTheme()}
                                >
                                    <MoonIcon />
                                    Dark
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Regional Section */}
                <section className="settings-section">
                    <h2 className="section-title">Regional</h2>

                    <div className="settings-card">
                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Timezone</span>
                                <span className="setting-description">Used for journal dates and calendar</span>
                            </div>
                            <select
                                className="timezone-select"
                                value={timezone}
                                onChange={handleTimezoneChange}
                            >
                                {COMMON_TIMEZONES.map(tz => (
                                    <option key={tz.value} value={tz.value}>
                                        {tz.label} ({tz.abbr})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                {/* Google Integration Section */}
                <section className="settings-section">
                    <h2 className="section-title">Google Integration</h2>

                    <div className="settings-card">
                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Google Drive</span>
                                <span className="setting-description">
                                    {user?.isDemo
                                        ? 'Sign in to enable cloud backup'
                                        : 'Your journals and tasks are saved to Google Drive'}
                                </span>
                            </div>
                            <div className={`status-badge ${user && !user.isDemo ? 'connected' : 'disconnected'}`}>
                                {user && !user.isDemo ? '✓ Connected' : '○ Not connected'}
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Google Calendar</span>
                                <span className="setting-description">
                                    {user?.isDemo
                                        ? 'Sign in to sync your calendars'
                                        : 'View your events from all calendars'}
                                </span>
                            </div>
                            <div className={`status-badge ${user && !user.isDemo ? 'connected' : 'disconnected'}`}>
                                {user && !user.isDemo ? '✓ Connected' : '○ Not connected'}
                            </div>
                        </div>
                    </div>

                    {user?.isDemo && (
                        <div className="settings-note">
                            <InfoIcon />
                            <p>
                                To enable Google Drive backup and Calendar sync, you need to set up a
                                Google Cloud Project. See the <strong>GOOGLE_CLOUD_SETUP.md</strong> file
                                for instructions.
                            </p>
                        </div>
                    )}
                </section>

                {/* Data Section */}
                <section className="settings-section">
                    <h2 className="section-title">Data</h2>

                    <div className="settings-card">
                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Export Data</span>
                                <span className="setting-description">Download all your journals and tasks</span>
                            </div>
                            <button className="btn btn-secondary">Export</button>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Clear Local Data</span>
                                <span className="setting-description">Remove all data from this device</span>
                            </div>
                            <button className="btn btn-ghost" style={{ color: 'var(--color-error)' }}>
                                Clear
                            </button>
                        </div>
                    </div>
                </section>

                {/* About Section */}
                <section className="settings-section">
                    <h2 className="section-title">About</h2>

                    <div className="settings-card">
                        <div className="about-info">
                            <div className="about-logo">📓</div>
                            <div className="about-text">
                                <h3>LifeOS Journal</h3>
                                <p>Version 1.0.0</p>
                                <p className="about-description">
                                    A personal journaling and productivity app built with React.
                                    Your data is stored securely in your own Google Drive.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}

// Icons
function SunIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
        </svg>
    )
}

function MoonIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
    )
}

function InfoIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
        </svg>
    )
}

export default Settings
