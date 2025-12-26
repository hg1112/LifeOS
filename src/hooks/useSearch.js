import { useState, useCallback, useRef, useEffect } from 'react'
import MiniSearch from 'minisearch'
import db from '../utils/db'

export function useSearch() {
    const [isIndexReady, setIsIndexReady] = useState(false)
    const searchIndexRef = useRef(null)
    const rebuildTimeoutRef = useRef(null)

    // Initialize MiniSearch with configuration
    const initializeIndex = useCallback(() => {
        searchIndexRef.current = new MiniSearch({
            fields: ['title', 'content', 'description'], // Fields to search
            storeFields: ['id', 'type', 'title', 'folder', 'date', 'priority', 'status'], // Fields to return
            searchOptions: {
                boost: { title: 2 }, // Give title matches higher priority
                fuzzy: 0.2, // Allow some typos
                prefix: true // Allow prefix matching
            }
        })
    }, [])

    // Build index from IndexedDB
    const buildIndex = useCallback(async () => {
        try {
            console.log('[Search] Building search index...')

            // Initialize fresh index
            initializeIndex()

            // Get all data from IndexedDB
            const [notes, tasks, journal] = await Promise.all([
                db.notes.toArray(),
                db.tasks.toArray(),
                db.journal.toArray()
            ])

            // Add notes to index
            notes.forEach(note => {
                searchIndexRef.current.add({
                    id: `note:${note.id}`,
                    type: 'note',
                    title: note.title,
                    content: note.content || '',
                    folder: note.folder
                })
            })

            // Add tasks to index
            tasks.forEach(task => {
                searchIndexRef.current.add({
                    id: `task:${task.id}`,
                    type: 'task',
                    title: task.title,
                    content: task.description || '',
                    description: task.description || '',
                    priority: task.priority,
                    status: task.status
                })
            })

            // Add journal entries to index
            journal.forEach(entry => {
                searchIndexRef.current.add({
                    id: `journal:${entry.date}`,
                    type: 'journal',
                    title: entry.date,
                    content: entry.content || '',
                    date: entry.date
                })
            })

            console.log('[Search] Index built with', notes.length, 'notes,', tasks.length, 'tasks,', journal.length, 'journal entries')
            setIsIndexReady(true)
        } catch (err) {
            console.error('[Search] Failed to build index:', err)
        }
    }, [initializeIndex])

    // Initialize index on mount
    useEffect(() => {
        buildIndex()
    }, [buildIndex])

    // Search across all content
    const search = useCallback((query, options = {}) => {
        if (!searchIndexRef.current || !query?.trim()) {
            return []
        }

        try {
            let results = searchIndexRef.current.search(query, {
                fuzzy: 0.2,
                prefix: true,
                combineWith: 'AND'
            })

            // Filter by type if specified
            if (options.type) {
                results = results.filter(r => r.type === options.type)
            }

            // Filter by folder if specified (for notes)
            if (options.folder) {
                results = results.filter(r => r.folder === options.folder)
            }

            // Filter by priority (for tasks)
            if (options.priority) {
                results = results.filter(r => r.priority === options.priority)
            }

            // Limit results
            const limit = options.limit || 20
            return results.slice(0, limit).map(r => ({
                id: r.id.split(':')[1], // Remove type prefix
                type: r.type,
                title: r.title,
                folder: r.folder,
                date: r.date,
                priority: r.priority,
                status: r.status,
                score: r.score
            }))
        } catch (err) {
            console.error('[Search] Search failed:', err)
            return []
        }
    }, [])

    // Add single document to index
    const addToIndex = useCallback((type, doc) => {
        if (!searchIndexRef.current) return

        try {
            const id = type === 'journal' ? doc.date : doc.id
            searchIndexRef.current.add({
                id: `${type}:${id}`,
                type,
                title: type === 'journal' ? doc.date : doc.title,
                content: type === 'task' ? doc.description : doc.content,
                description: doc.description,
                folder: doc.folder,
                date: doc.date,
                priority: doc.priority,
                status: doc.status
            })
        } catch (err) {
            // Document might already exist, try to update instead
            updateInIndex(type, doc)
        }
    }, [])

    // Update document in index
    const updateInIndex = useCallback((type, doc) => {
        if (!searchIndexRef.current) return

        try {
            const id = type === 'journal' ? doc.date : doc.id
            const docId = `${type}:${id}`

            // Remove old version
            searchIndexRef.current.discard(docId)

            // Add updated version
            searchIndexRef.current.add({
                id: docId,
                type,
                title: type === 'journal' ? doc.date : doc.title,
                content: type === 'task' ? doc.description : doc.content,
                description: doc.description,
                folder: doc.folder,
                date: doc.date,
                priority: doc.priority,
                status: doc.status
            })
        } catch (err) {
            console.error('[Search] Failed to update in index:', err)
        }
    }, [])

    // Remove document from index
    const removeFromIndex = useCallback((type, id) => {
        if (!searchIndexRef.current) return

        try {
            searchIndexRef.current.discard(`${type}:${id}`)
        } catch (err) {
            console.error('[Search] Failed to remove from index:', err)
        }
    }, [])

    // Debounced rebuild
    const scheduleRebuild = useCallback(() => {
        if (rebuildTimeoutRef.current) {
            clearTimeout(rebuildTimeoutRef.current)
        }
        rebuildTimeoutRef.current = setTimeout(() => {
            buildIndex()
        }, 5000) // Rebuild after 5 seconds of inactivity
    }, [buildIndex])

    return {
        isIndexReady,
        search,
        addToIndex,
        updateInIndex,
        removeFromIndex,
        rebuildIndex: buildIndex,
        scheduleRebuild
    }
}

export default useSearch
