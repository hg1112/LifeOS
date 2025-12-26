import { useCallback, useRef, useEffect, useState } from 'react'
import db, { exportMetadata, importMetadata } from '../utils/db'

export function useDatabase() {
    const [isReady, setIsReady] = useState(false)
    const [error, setError] = useState(null)
    const syncTimeoutRef = useRef(null)

    // Initialize database
    useEffect(() => {
        db.open()
            .then(() => setIsReady(true))
            .catch(err => {
                console.error('[DB] Failed to open database:', err)
                setError(err.message)
            })
    }, [])

    // ========== NOTES ==========
    const saveNoteToDb = useCallback(async (note) => {
        try {
            await db.notes.put({
                id: note.id,
                title: note.title,
                content: note.content,
                folder: note.folder || 'root',
                createdAt: note.createdAt,
                updatedAt: note.updatedAt
            })
        } catch (err) {
            console.error('[DB] Failed to save note:', err)
        }
    }, [])

    const deleteNoteFromDb = useCallback(async (noteId) => {
        try {
            await db.notes.delete(noteId)
        } catch (err) {
            console.error('[DB] Failed to delete note:', err)
        }
    }, [])

    const getAllNotes = useCallback(async () => {
        try {
            return await db.notes.toArray()
        } catch (err) {
            console.error('[DB] Failed to get notes:', err)
            return []
        }
    }, [])

    const searchNotes = useCallback(async (query, options = {}) => {
        try {
            let results = db.notes.toCollection()

            if (options.folder) {
                results = db.notes.where('folder').equals(options.folder)
            }

            const notes = await results.toArray()

            if (query) {
                const lowerQuery = query.toLowerCase()
                return notes.filter(n =>
                    n.title?.toLowerCase().includes(lowerQuery) ||
                    n.content?.toLowerCase().includes(lowerQuery)
                )
            }

            return notes
        } catch (err) {
            console.error('[DB] Search failed:', err)
            return []
        }
    }, [])

    // ========== TASKS ==========
    const saveTaskToDb = useCallback(async (task) => {
        try {
            await db.tasks.put({
                id: task.id,
                title: task.title,
                description: task.description || '',
                priority: task.priority,
                status: task.status,
                dueDate: task.dueDate,
                completed: task.completed,
                createdAt: task.createdAt,
                isAllDay: task.isAllDay,
                startTime: task.startTime,
                endTime: task.endTime
            })
        } catch (err) {
            console.error('[DB] Failed to save task:', err)
        }
    }, [])

    const deleteTaskFromDb = useCallback(async (taskId) => {
        try {
            await db.tasks.delete(taskId)
        } catch (err) {
            console.error('[DB] Failed to delete task:', err)
        }
    }, [])

    const getAllTasks = useCallback(async () => {
        try {
            return await db.tasks.toArray()
        } catch (err) {
            console.error('[DB] Failed to get tasks:', err)
            return []
        }
    }, [])

    const searchTasks = useCallback(async (query, options = {}) => {
        try {
            let collection = db.tasks.toCollection()

            if (options.priority) {
                collection = db.tasks.where('priority').equals(options.priority)
            }

            if (options.status) {
                collection = db.tasks.where('status').equals(options.status)
            }

            const tasks = await collection.toArray()

            if (query) {
                const lowerQuery = query.toLowerCase()
                return tasks.filter(t =>
                    t.title?.toLowerCase().includes(lowerQuery) ||
                    t.description?.toLowerCase().includes(lowerQuery)
                )
            }

            return tasks
        } catch (err) {
            console.error('[DB] Task search failed:', err)
            return []
        }
    }, [])

    // ========== JOURNAL ==========
    const saveJournalToDb = useCallback(async (entry) => {
        try {
            await db.journal.put({
                date: entry.date,
                content: entry.content,
                lastModified: entry.lastModified || new Date().toISOString()
            })
        } catch (err) {
            console.error('[DB] Failed to save journal:', err)
        }
    }, [])

    const getAllJournal = useCallback(async () => {
        try {
            return await db.journal.toArray()
        } catch (err) {
            console.error('[DB] Failed to get journal:', err)
            return []
        }
    }, [])

    const searchJournal = useCallback(async (query) => {
        try {
            const entries = await db.journal.toArray()

            if (query) {
                const lowerQuery = query.toLowerCase()
                return entries.filter(j =>
                    j.date?.includes(query) ||
                    j.content?.toLowerCase().includes(lowerQuery)
                )
            }

            return entries
        } catch (err) {
            console.error('[DB] Journal search failed:', err)
            return []
        }
    }, [])

    // ========== SYNC ==========
    const exportDbMetadata = useCallback(async () => {
        return await exportMetadata()
    }, [])

    const importDbMetadata = useCallback(async (metadata) => {
        await importMetadata(metadata)
    }, [])

    // Bulk sync all data to DB
    const syncAllToDb = useCallback(async (notes, tasks, journalEntries) => {
        try {
            // Sync notes
            if (notes) {
                await db.notes.clear()
                await db.notes.bulkPut(notes.map(n => ({
                    id: n.id,
                    title: n.title,
                    content: n.content,
                    folder: n.folder || 'root',
                    createdAt: n.createdAt,
                    updatedAt: n.updatedAt
                })))
            }

            // Sync tasks
            if (tasks) {
                await db.tasks.clear()
                await db.tasks.bulkPut(tasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    description: t.description || '',
                    priority: t.priority,
                    status: t.status,
                    dueDate: t.dueDate,
                    completed: t.completed,
                    createdAt: t.createdAt
                })))
            }

            // Sync journal
            if (journalEntries) {
                await db.journal.clear()
                const entries = Object.entries(journalEntries).map(([date, entry]) => ({
                    date,
                    content: entry.content,
                    lastModified: entry.lastModified
                }))
                await db.journal.bulkPut(entries)
            }

            // Update sync timestamp
            await db.syncMeta.put({ key: 'lastSync', value: new Date().toISOString() })

            console.log('[DB] Synced all data to IndexedDB')
        } catch (err) {
            console.error('[DB] Sync failed:', err)
        }
    }, [])

    return {
        isReady,
        error,
        // Notes
        saveNoteToDb,
        deleteNoteFromDb,
        getAllNotes,
        searchNotes,
        // Tasks
        saveTaskToDb,
        deleteTaskFromDb,
        getAllTasks,
        searchTasks,
        // Journal
        saveJournalToDb,
        getAllJournal,
        searchJournal,
        // Sync
        exportDbMetadata,
        importDbMetadata,
        syncAllToDb
    }
}

export default useDatabase
