import { useState, useContext, useMemo } from 'react'
import { DataContext } from '../App'
import './Notes.css'

function Notes() {
    const { notes, addNote, updateNote, deleteNote } = useContext(DataContext)
    const [selectedNoteId, setSelectedNoteId] = useState(null)
    const [isEditing, setIsEditing] = useState(false)
    const [showNewFolder, setShowNewFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedFolders, setExpandedFolders] = useState({ root: true })

    // Get current note
    const selectedNote = notes.find(n => n.id === selectedNoteId)

    // Organize notes by folder
    const notesByFolder = useMemo(() => {
        const folders = { root: [] }
        notes.forEach(note => {
            const folder = note.folder || 'root'
            if (!folders[folder]) folders[folder] = []
            folders[folder].push(note)
        })
        // Sort notes by updated date
        Object.keys(folders).forEach(key => {
            folders[key].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        })
        return folders
    }, [notes])

    // Get unique folder names
    const folderNames = useMemo(() => {
        const names = new Set(['root'])
        notes.forEach(note => {
            if (note.folder) names.add(note.folder)
        })
        return Array.from(names).sort()
    }, [notes])

    // Filter notes by search
    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) return null
        const query = searchQuery.toLowerCase()
        return notes.filter(note =>
            note.title.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query)
        )
    }, [notes, searchQuery])

    const toggleFolder = (folder) => {
        setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }))
    }

    const createNewNote = (folder = 'root') => {
        const newNote = {
            id: Date.now().toString(),
            title: 'Untitled Note',
            content: '# New Note\n\nStart writing here...',
            folder,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
        addNote(newNote)
        setSelectedNoteId(newNote.id)
        setIsEditing(true)
    }

    const createNewFolder = () => {
        if (!newFolderName.trim()) return
        // Create folder by creating a note in it
        createNewNote(newFolderName.trim())
        setNewFolderName('')
        setShowNewFolder(false)
        setExpandedFolders(prev => ({ ...prev, [newFolderName.trim()]: true }))
    }

    const handleNoteChange = (field, value) => {
        if (!selectedNote) return
        updateNote(selectedNote.id, {
            [field]: value,
            updatedAt: new Date().toISOString()
        })
    }

    const handleDeleteNote = (noteId) => {
        if (confirm('Delete this note?')) {
            deleteNote(noteId)
            if (selectedNoteId === noteId) {
                setSelectedNoteId(null)
            }
        }
    }

    const moveNoteToFolder = (noteId, folder) => {
        updateNote(noteId, { folder, updatedAt: new Date().toISOString() })
    }

    return (
        <div className="notes-page">
            {/* Sidebar */}
            <aside className="notes-sidebar">
                <div className="sidebar-header">
                    <h2>Notes</h2>
                    <button className="btn btn-primary btn-sm" onClick={() => createNewNote()}>
                        <PlusIcon /> New
                    </button>
                </div>

                {/* Search */}
                <div className="search-box">
                    <SearchIcon />
                    <input
                        type="text"
                        placeholder="Search notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => setSearchQuery('')}>×</button>
                    )}
                </div>

                {/* Search Results */}
                {filteredNotes ? (
                    <div className="search-results">
                        <div className="folder-header">
                            <span>Search Results ({filteredNotes.length})</span>
                        </div>
                        {filteredNotes.map(note => (
                            <NoteItem
                                key={note.id}
                                note={note}
                                isSelected={selectedNoteId === note.id}
                                onClick={() => { setSelectedNoteId(note.id); setSearchQuery('') }}
                                onDelete={() => handleDeleteNote(note.id)}
                            />
                        ))}
                        {filteredNotes.length === 0 && (
                            <p className="no-results">No notes found</p>
                        )}
                    </div>
                ) : (
                    /* Folder Tree */
                    <div className="folder-tree">
                        {folderNames.map(folder => (
                            <div key={folder} className="folder-group">
                                <div className="folder-header" onClick={() => toggleFolder(folder)}>
                                    <CollapseIcon collapsed={!expandedFolders[folder]} />
                                    <FolderIcon open={expandedFolders[folder]} />
                                    <span>{folder === 'root' ? 'All Notes' : folder}</span>
                                    <span className="folder-count">{notesByFolder[folder]?.length || 0}</span>
                                </div>
                                {expandedFolders[folder] && notesByFolder[folder]?.map(note => (
                                    <NoteItem
                                        key={note.id}
                                        note={note}
                                        isSelected={selectedNoteId === note.id}
                                        onClick={() => setSelectedNoteId(note.id)}
                                        onDelete={() => handleDeleteNote(note.id)}
                                    />
                                ))}
                            </div>
                        ))}

                        {/* New Folder */}
                        {showNewFolder ? (
                            <div className="new-folder-input">
                                <input
                                    type="text"
                                    placeholder="Folder name..."
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && createNewFolder()}
                                    autoFocus
                                />
                                <button className="btn btn-sm" onClick={createNewFolder}>Add</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewFolder(false)}>×</button>
                            </div>
                        ) : (
                            <button className="add-folder-btn" onClick={() => setShowNewFolder(true)}>
                                <PlusIcon /> New Folder
                            </button>
                        )}
                    </div>
                )}
            </aside>

            {/* Editor */}
            <main className="notes-editor">
                {selectedNote ? (
                    <>
                        <div className="editor-header">
                            <input
                                type="text"
                                className="note-title-input"
                                value={selectedNote.title}
                                onChange={(e) => handleNoteChange('title', e.target.value)}
                                placeholder="Note title..."
                            />
                            <div className="editor-actions">
                                <select
                                    className="folder-select"
                                    value={selectedNote.folder || 'root'}
                                    onChange={(e) => moveNoteToFolder(selectedNote.id, e.target.value)}
                                >
                                    {folderNames.map(f => (
                                        <option key={f} value={f}>{f === 'root' ? 'All Notes' : f}</option>
                                    ))}
                                </select>
                                <button
                                    className={`btn btn-sm ${isEditing ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setIsEditing(!isEditing)}
                                >
                                    {isEditing ? 'Preview' : 'Edit'}
                                </button>
                            </div>
                        </div>

                        <div className="editor-content">
                            {isEditing ? (
                                <textarea
                                    className="markdown-editor"
                                    value={selectedNote.content}
                                    onChange={(e) => handleNoteChange('content', e.target.value)}
                                    placeholder="Write your note in markdown..."
                                />
                            ) : (
                                <div
                                    className="markdown-preview"
                                    dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedNote.content) }}
                                />
                            )}
                        </div>

                        <div className="editor-footer">
                            <span className="note-meta">
                                Last updated: {new Date(selectedNote.updatedAt).toLocaleString()}
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="empty-editor">
                        <NoteIcon />
                        <h3>Select a note or create a new one</h3>
                        <button className="btn btn-primary" onClick={() => createNewNote()}>
                            <PlusIcon /> Create Note
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}

function NoteItem({ note, isSelected, onClick, onDelete }) {
    return (
        <div className={`note-item ${isSelected ? 'selected' : ''}`} onClick={onClick}>
            <DocumentIcon />
            <div className="note-info">
                <span className="note-title">{note.title}</span>
                <span className="note-date">{formatDate(note.updatedAt)}</span>
            </div>
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete() }}>
                <TrashIcon />
            </button>
        </div>
    )
}

// Simple markdown parser
function parseMarkdown(text) {
    if (!text) return ''
    return text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2" />')
        .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
        .replace(/`(.*?)`/gim, '<code>$1</code>')
        .replace(/^\s*\n/gm, '<br />')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
}

function formatDate(dateString) {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
}

// Icons
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></svg> }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg> }
function FolderIcon({ open }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{open ? <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h9a2 2 0 0 1 2 2v1M5 19h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2Z" /> : <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />}</svg> }
function DocumentIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg> }
function NoteIcon() { return <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg> }
function CollapseIcon({ collapsed }) { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}><path d="m6 9 6 6 6-6" /></svg> }

export default Notes
