import { useState, useContext, useEffect, useRef, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DataContext } from '../App'
import './Journal.css'

// Lazy load DrawingModal
const DrawingModal = lazy(() => import('../components/DrawingModal/DrawingModal'))

function Journal() {
    const { date } = useParams()
    const navigate = useNavigate()
    const { journalEntries, updateJournalEntry, syncStatus, drawings, saveDrawing } = useContext(DataContext)
    const textareaRef = useRef(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [focusMode, setFocusMode] = useState(false)
    const [fontSize, setFontSize] = useState('base')
    const [showDrawingModal, setShowDrawingModal] = useState(false)
    const [editingDrawing, setEditingDrawing] = useState(null)

    const today = new Date().toISOString().split('T')[0]
    const currentDate = date || today

    const entry = journalEntries[currentDate] || {
        date: currentDate,
        content: `# ${formatDate(currentDate)}\n\n`,
        lastModified: null
    }

    const [content, setContent] = useState(entry.content)
    const [showPreview, setShowPreview] = useState(false)

    useEffect(() => {
        const newEntry = journalEntries[currentDate]
        setContent(newEntry ? newEntry.content : `# ${formatDate(currentDate)}\n\n`)
    }, [currentDate, journalEntries])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (content !== entry.content) {
                updateJournalEntry(currentDate, content)
            }
        }, 500)
        return () => clearTimeout(timer)
    }, [content, currentDate, entry.content, updateJournalEntry])

    const goToDate = (offset) => {
        const current = new Date(currentDate + 'T12:00:00')
        current.setDate(current.getDate() + offset)
        navigate(`/journal/${current.toISOString().split('T')[0]}`)
    }

    const entryDates = Object.keys(journalEntries).sort().reverse()
    const filteredDates = searchQuery.trim()
        ? entryDates.filter(d => journalEntries[d]?.content?.toLowerCase().includes(searchQuery.toLowerCase()))
        : entryDates

    const insertText = (before, after = '') => {
        const textarea = textareaRef.current
        if (!textarea) return
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selected = content.substring(start, end)
        const newContent = content.substring(0, start) + before + selected + after + content.substring(end)
        setContent(newContent)
        setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(start + before.length, end + before.length)
        }, 0)
    }

    const handleHeadingChange = (e) => {
        const val = e.target.value
        if (val) insertText(`\n${val} `, '')
        e.target.value = ''
    }

    const handleListChange = (e) => {
        const val = e.target.value
        if (val) insertText(`\n${val} `, '')
        e.target.value = ''
    }

    const insertLink = () => {
        const url = prompt('Enter URL:')
        if (url) {
            const text = prompt('Enter link text:', 'Link') || 'Link'
            insertText(`[${text}](${url})`, '')
        }
    }

    const insertImage = () => {
        const url = prompt('Enter image URL:')
        if (url) {
            const alt = prompt('Enter alt text:', 'Image') || 'Image'
            insertText(`\n![${alt}](${url})\n`, '')
        }
    }

    const handleSaveDrawing = (drawingData) => {
        // Save the drawing to the drawings store
        saveDrawing(drawingData)

        if (editingDrawing) {
            // Update existing drawing reference in content
            const regex = new RegExp(`!\\[Drawing:${editingDrawing.id}\\]\\([^)]+\\)`, 'g')
            const newContent = content.replace(regex, `![Drawing:${drawingData.id}](${drawingData.image})`)
            setContent(newContent)
            setEditingDrawing(null)
        } else {
            // Insert new drawing
            insertText(`\n![Drawing:${drawingData.id}](${drawingData.image})\n`, '')
        }
    }

    const handleEditDrawing = (drawingId) => {
        const drawing = drawings?.find(d => d.id === drawingId)
        if (drawing) {
            setEditingDrawing(drawing)
            setShowDrawingModal(true)
        }
    }

    const fontSizeClass = `font-${fontSize}`

    return (
        <div className={`journal-page ${focusMode ? 'focus-mode' : ''}`}>
            {/* Entries Sidebar */}
            <aside className={`journal-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="journal-sidebar-header">
                    {!sidebarCollapsed && <h2>Entries</h2>}
                    <button className="btn btn-ghost btn-icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
                        {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
                    </button>
                </div>

                {!sidebarCollapsed && (
                    <>
                        <div className="sidebar-actions">
                            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/journal/${today}`)}>Today</button>
                        </div>
                        <div className="journal-search">
                            <SearchIcon />
                            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            {searchQuery && <button className="clear-search" onClick={() => setSearchQuery('')}>×</button>}
                        </div>
                        <div className="entry-list">
                            {filteredDates.length === 0 && searchQuery && <div className="no-results">No entries found</div>}
                            {filteredDates.map(d => (
                                <button key={d} className={`entry-list-item ${d === currentDate ? 'active' : ''}`} onClick={() => navigate(`/journal/${d}`)}>
                                    <span className="entry-date-day">{new Date(d + 'T12:00:00').getDate()}</span>
                                    <div className="entry-date-info">
                                        <span className="entry-date-weekday">{new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                        <span className="entry-date-month">{new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </aside>

            {/* Editor */}
            <div className="journal-editor">
                {/* Header */}
                <header className="journal-header">
                    <div className="journal-nav">
                        <button className="btn btn-ghost btn-icon" onClick={() => goToDate(-1)} title="Previous day"><ChevronLeft /></button>
                        <h1 className="journal-date-title">{formatDateShort(currentDate)}</h1>
                        <button className="btn btn-ghost btn-icon" onClick={() => goToDate(1)} title="Next day"><ChevronRight /></button>
                    </div>
                    <div className="journal-actions">
                        <span className={`sync-badge ${syncStatus}`}>{syncStatus === 'syncing' ? 'Saving...' : '✓'}</span>
                        <button className={`btn btn-ghost btn-sm ${focusMode ? 'active' : ''}`} onClick={() => setFocusMode(!focusMode)} title="Focus Mode">
                            <FocusIcon /> Focus
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowPreview(!showPreview)}>
                            {showPreview ? '✏️ Edit' : '👁️ Preview'}
                        </button>
                    </div>
                </header>

                {/* Compact Toolbar */}
                {!showPreview && (
                    <div className="rich-toolbar">
                        {/* Text Formatting */}
                        <button className="toolbar-btn" onClick={() => insertText('**', '**')} title="Bold"><strong>B</strong></button>
                        <button className="toolbar-btn" onClick={() => insertText('*', '*')} title="Italic"><em>I</em></button>
                        <button className="toolbar-btn" onClick={() => insertText('~~', '~~')} title="Strikethrough"><s>S</s></button>
                        <button className="toolbar-btn" onClick={() => insertText('`', '`')} title="Code">&lt;/&gt;</button>

                        <div className="toolbar-divider" />

                        {/* Block Format Dropdown */}
                        <select className="toolbar-select" onChange={handleHeadingChange} defaultValue="" title="Block Format">
                            <option value="" disabled>Format</option>
                            <option value="">Paragraph</option>
                            <option value="#">H1 - Title</option>
                            <option value="##">H2 - Section</option>
                            <option value="###">H3 - Subsection</option>
                            <option value="####">H4 - Small</option>
                            <option value="```">Code Block</option>
                        </select>

                        {/* List Types Dropdown */}
                        <select className="toolbar-select" onChange={handleListChange} defaultValue="" title="Lists">
                            <option value="" disabled>List</option>
                            <option value="-">• Bullet</option>
                            <option value="*">∗ Asterisk</option>
                            <option value="+">+ Plus</option>
                            <option value="1.">1. Numbered</option>
                            <option value="- [ ]">☐ Checkbox</option>
                            <option value="- [x]">☑ Checked</option>
                            <option value=">">❝ Quote</option>
                            <option value="---">── Divider</option>
                        </select>

                        <div className="toolbar-divider" />

                        {/* Media */}
                        <button className="toolbar-btn" onClick={insertLink} title="Insert Link">🔗</button>
                        <button className="toolbar-btn" onClick={insertImage} title="Insert Image">🖼️</button>
                        <button className="toolbar-btn" onClick={() => setShowDrawingModal(true)} title="Create Drawing">✏️</button>

                        <div className="toolbar-divider" />

                        {/* Font Size */}
                        <select className="toolbar-select" value={fontSize} onChange={(e) => setFontSize(e.target.value)} title="Font Size">
                            <option value="small">Small</option>
                            <option value="base">Normal</option>
                            <option value="large">Large</option>
                            <option value="xl">X-Large</option>
                        </select>

                        <div className="toolbar-spacer" />
                        <span className="word-count">{content.split(/\s+/).filter(w => w.length > 0).length} words</span>
                    </div>
                )}

                {/* Content */}
                <div className="journal-content">
                    {showPreview ? (
                        <div className={`journal-preview markdown-body ${fontSizeClass}`}>
                            <MarkdownPreview content={content} onEditDrawing={handleEditDrawing} />
                        </div>
                    ) : (
                        <textarea
                            ref={textareaRef}
                            className={`journal-textarea ${fontSizeClass}`}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Start writing..."
                            spellCheck="false"
                        />
                    )}
                </div>
            </div>

            {/* Drawing Modal */}
            {showDrawingModal && (
                <Suspense fallback={<div>Loading...</div>}>
                    <DrawingModal
                        isOpen={showDrawingModal}
                        onClose={() => {
                            setShowDrawingModal(false)
                            setEditingDrawing(null)
                        }}
                        onSave={handleSaveDrawing}
                        initialData={editingDrawing}
                    />
                </Suspense>
            )}
        </div>
    )
}

function MarkdownPreview({ content, onEditDrawing }) {
    // Handle drawing clicks
    const handleClick = (e) => {
        const target = e.target
        if (target.tagName === 'IMG' && target.dataset.drawingId) {
            onEditDrawing?.(target.dataset.drawingId)
        }
    }

    const html = content
        .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\- \[x\] (.*$)/gim, '<div class="task-item completed"><input type="checkbox" checked disabled /> $1</div>')
        .replace(/^\- \[ \] (.*$)/gim, '<div class="task-item"><input type="checkbox" disabled /> $1</div>')
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/^---$/gim, '<hr />')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^\+ (.*$)/gim, '<li>$1</li>')
        .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        // Make drawings clickable with a data attribute
        .replace(/!\[Drawing:(\w+)\]\(([^)]+)\)/g, '<div class="drawing-container"><img alt="Drawing" src="$2" data-drawing-id="$1" class="editable-drawing" /><div class="drawing-edit-hint">Click to edit</div></div>')
        // Regular images
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" style="max-width:100%;border-radius:8px;margin:1rem 0" />')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\n/g, '<br />')

    return <div onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />
}

// Icons
function ChevronLeft() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
}

function ChevronRight() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
}

function SearchIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
}

function FocusIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateShort(dateString) {
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default Journal
