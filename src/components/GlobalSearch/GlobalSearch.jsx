import { useState, useContext, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataContext } from '../../App'
import './GlobalSearch.css'

function GlobalSearch({ isOpen, onClose }) {
    const navigate = useNavigate()
    const { journalEntries, notes, tasks } = useContext(DataContext)
    const [query, setQuery] = useState('')
    const inputRef = useRef(null)

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    // Clear query when closed
    useEffect(() => {
        if (!isOpen) setQuery('')
    }, [isOpen])

    // Search results combining all content types
    const results = useMemo(() => {
        if (!query.trim()) return { journals: [], notes: [], tasks: [] }

        const q = query.toLowerCase()

        // Search journal entries
        const journalResults = Object.entries(journalEntries)
            .filter(([date, entry]) => entry.content?.toLowerCase().includes(q))
            .map(([date, entry]) => ({
                id: date,
                type: 'journal',
                title: formatDate(date),
                date,
                preview: getPreview(entry.content, q)
            }))
            .slice(0, 4)

        // Search notes
        const noteResults = notes
            .filter(note =>
                note.title?.toLowerCase().includes(q) ||
                note.content?.toLowerCase().includes(q)
            )
            .map(note => ({
                id: note.id,
                type: 'note',
                title: note.title,
                folder: note.folder,
                preview: getPreview(note.content, q)
            }))
            .slice(0, 4)

        // Search tasks
        const taskResults = tasks
            .filter(task => task.title?.toLowerCase().includes(q))
            .map(task => ({
                id: task.id,
                type: 'task',
                title: task.title,
                status: task.status || 'backlog',
                priority: task.priority,
                completed: task.completed
            }))
            .slice(0, 4)

        return { journals: journalResults, notes: noteResults, tasks: taskResults }
    }, [query, journalEntries, notes, tasks])

    const totalResults = results.journals.length + results.notes.length + results.tasks.length

    const handleSelect = (result) => {
        if (result.type === 'journal') {
            navigate(`/journal/${result.date}`)
        } else if (result.type === 'note') {
            navigate('/notes')
        } else if (result.type === 'task') {
            navigate('/tasks')
        }
        onClose()
    }

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="global-search-overlay" onClick={onClose}>
            <div className="global-search-modal" onClick={e => e.stopPropagation()}>
                <div className="search-input-wrapper">
                    <SearchIcon />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search everything..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="global-search-input"
                    />
                    <kbd className="search-shortcut">ESC</kbd>
                </div>

                {query.trim() && (
                    <div className="search-results">
                        {totalResults === 0 ? (
                            <div className="no-results">
                                <p>No results found for "{query}"</p>
                            </div>
                        ) : (
                            <>
                                {/* Task Results */}
                                {results.tasks.length > 0 && (
                                    <div className="result-section">
                                        <h3 className="result-section-title">
                                            <TaskIcon /> Tasks
                                        </h3>
                                        {results.tasks.map(result => (
                                            <button
                                                key={result.id}
                                                className="result-item"
                                                onClick={() => handleSelect(result)}
                                            >
                                                <div className="result-content">
                                                    <span className={`result-title ${result.completed ? 'completed' : ''}`}>
                                                        {result.title}
                                                    </span>
                                                    <span className="result-meta">
                                                        <span className={`priority-badge ${result.priority}`}>{result.priority}</span>
                                                        <span className="status-badge">{result.status}</span>
                                                    </span>
                                                </div>
                                                <ArrowIcon />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Journal Results */}
                                {results.journals.length > 0 && (
                                    <div className="result-section">
                                        <h3 className="result-section-title">
                                            <JournalIcon /> Journal Entries
                                        </h3>
                                        {results.journals.map(result => (
                                            <button
                                                key={result.id}
                                                className="result-item"
                                                onClick={() => handleSelect(result)}
                                            >
                                                <div className="result-content">
                                                    <span className="result-title">{result.title}</span>
                                                    <span className="result-preview">{result.preview}</span>
                                                </div>
                                                <ArrowIcon />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Note Results */}
                                {results.notes.length > 0 && (
                                    <div className="result-section">
                                        <h3 className="result-section-title">
                                            <NoteIcon /> Notes
                                        </h3>
                                        {results.notes.map(result => (
                                            <button
                                                key={result.id}
                                                className="result-item"
                                                onClick={() => handleSelect(result)}
                                            >
                                                <div className="result-content">
                                                    <span className="result-title">{result.title}</span>
                                                    {result.folder && result.folder !== 'root' && (
                                                        <span className="result-folder">{result.folder}</span>
                                                    )}
                                                    <span className="result-preview">{result.preview}</span>
                                                </div>
                                                <ArrowIcon />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {!query.trim() && (
                    <div className="search-hints">
                        <p>Search across journals, notes, and tasks</p>
                        <div className="search-tips">
                            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
                            <span><kbd>Enter</kbd> select</span>
                            <span><kbd>ESC</kbd> close</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getPreview(content, query) {
    if (!content) return ''
    const lowerContent = content.toLowerCase()
    const index = lowerContent.indexOf(query.toLowerCase())
    if (index === -1) return content.slice(0, 60) + '...'

    const start = Math.max(0, index - 20)
    const end = Math.min(content.length, index + query.length + 40)
    let preview = content.slice(start, end)
    if (start > 0) preview = '...' + preview
    if (end < content.length) preview = preview + '...'
    return preview.replace(/\n/g, ' ').replace(/#{1,3}\s/g, '')
}

// Icons
function SearchIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    )
}

function JournalIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
    )
}

function NoteIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
        </svg>
    )
}

function TaskIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
    )
}

function ArrowIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6" />
        </svg>
    )
}

export default GlobalSearch
