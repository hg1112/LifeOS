import { useState, useCallback, useRef, useEffect, useContext } from 'react'
import { AuthContext } from '../App'
import { getStoredUsername } from '../utils/clientIdStorage'

const FOLDER_NAME = 'LifeOS'
const JOURNAL_FOLDER = 'journal'
const NOTES_FOLDER = 'notes'
const TASKS_FILE = 'tasks.json'
const METADATA_FILE = 'metadata.json'
const SETTINGS_FILE = 'settings.json'

export function useGoogleDrive() {
    const { getAccessToken, user } = useContext(AuthContext)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [folders, setFolders] = useState({
        root: null,
        user: null,
        journal: null,
        notes: null
    })

    // Cache for file IDs to prevent duplicate creation (race condition fix)
    const fileIdCache = useRef({})
    // Track pending saves to prevent concurrent creates
    const pendingSaves = useRef({})
    // Track current user to detect user changes
    const currentUserEmail = useRef(null)

    // Clear folder cache when user changes
    useEffect(() => {
        const userEmail = user?.email || null
        if (currentUserEmail.current !== userEmail) {
            console.log('[Drive] User changed, clearing folder cache:', currentUserEmail.current, '->', userEmail)
            currentUserEmail.current = userEmail
            setFolders({ root: null, user: null, journal: null, notes: null })
            fileIdCache.current = {}
        }
    }, [user?.email])

    // Initialize folder structure
    const initializeFolders = useCallback(async () => {
        if (user?.isDemo) {
            console.log('Demo mode - skipping Drive initialization')
            return { root: 'demo', journal: 'demo' }
        }

        const token = getAccessToken()
        if (!token) {
            throw new Error('Not authenticated')
        }

        setIsLoading(true)
        setError(null)

        try {
            // Find or create LifeOS folder
            console.log('[Drive] Looking for LifeOS folder in root...')
            let rootFolder = await findFolder(token, FOLDER_NAME, 'root')
            console.log('[Drive] Root folder result:', rootFolder)
            if (!rootFolder) {
                console.log('[Drive] Creating LifeOS folder...')
                rootFolder = await createFolder(token, FOLDER_NAME, 'root')
            }

            // Find or create user-specific subfolder
            // Priority: user email prefix > stored username > user id > 'default'
            const userFolderName = user?.email?.split('@')[0] || getStoredUsername() || user?.id || 'default'
            console.log('[Drive] Looking for user folder:', userFolderName, 'in', rootFolder.id)
            let userFolder = await findFolder(token, userFolderName, rootFolder.id)
            console.log('[Drive] User folder result:', userFolder)
            if (!userFolder) {
                console.log('[Drive] Creating user folder:', userFolderName)
                userFolder = await createFolder(token, userFolderName, rootFolder.id)
            }

            // Find or create journal subfolder inside user folder
            console.log('[Drive] Looking for journal folder in user folder', userFolder.id)
            let journalFolder = await findFolder(token, JOURNAL_FOLDER, userFolder.id)
            console.log('[Drive] Journal folder result:', journalFolder)
            if (!journalFolder) {
                console.log('[Drive] Creating journal folder...')
                journalFolder = await createFolder(token, JOURNAL_FOLDER, userFolder.id)
            }

            // Find or create notes subfolder inside user folder
            console.log('[Drive] Looking for notes folder in user folder', userFolder.id)
            let notesFolder = await findFolder(token, NOTES_FOLDER, userFolder.id)
            console.log('[Drive] Notes folder result:', notesFolder)
            if (!notesFolder) {
                console.log('[Drive] Creating notes folder...')
                notesFolder = await createFolder(token, NOTES_FOLDER, userFolder.id)
            }

            const folderIds = {
                root: rootFolder.id,
                user: userFolder.id,
                journal: journalFolder.id,
                notes: notesFolder.id
            }

            console.log('[Drive] Initialized folders:', folderIds)
            setFolders(folderIds)
            setIsLoading(false)
            return folderIds
        } catch (err) {
            console.error('[Drive] Folder initialization error:', err)
            setError(err.message)
            setIsLoading(false)
            throw err
        }
    }, [getAccessToken, user])

    // Save journal entry
    const saveJournalEntry = useCallback(async (date, content) => {
        if (user?.isDemo) {
            console.log('Demo mode - journal saved locally only')
            return { id: `demo-${date}`, name: `${date}.md` }
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.journal || (await initializeFolders()).journal
        const fileName = `${date}.md`
        const cacheKey = `journal:${date}`

        // Wait for any pending save for this date to complete (prevents race condition)
        if (pendingSaves.current[cacheKey]) {
            await pendingSaves.current[cacheKey]
        }

        // Check cache first (prevents duplicate creation)
        let fileId = fileIdCache.current[cacheKey]

        // If not in cache, check if file exists on Drive
        if (!fileId) {
            const existingFile = await findFile(token, fileName, folderId)
            if (existingFile) {
                fileId = existingFile.id
                fileIdCache.current[cacheKey] = fileId
            }
        }

        // Create a promise that other saves can wait on
        const savePromise = (async () => {
            try {
                if (fileId) {
                    // Update existing file
                    return await updateFile(token, fileId, content)
                } else {
                    // Create new file and cache the ID
                    const newFile = await createFile(token, fileName, content, folderId, 'text/markdown')
                    fileIdCache.current[cacheKey] = newFile.id
                    return newFile
                }
            } finally {
                // Clear pending save
                delete pendingSaves.current[cacheKey]
            }
        })()

        pendingSaves.current[cacheKey] = savePromise
        return savePromise
    }, [getAccessToken, user, folders.journal, initializeFolders])

    // Load journal entry
    const loadJournalEntry = useCallback(async (date) => {
        if (user?.isDemo) {
            return null // Demo mode returns null, app uses local state
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.journal || (await initializeFolders()).journal
        const fileName = `${date}.md`

        const file = await findFile(token, fileName, folderId)
        if (!file) return null

        return await downloadFile(token, file.id)
    }, [getAccessToken, user, folders.journal, initializeFolders])

    // List journal entries
    const listJournalEntries = useCallback(async () => {
        if (user?.isDemo) {
            return [] // Demo mode
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.journal || (await initializeFolders()).journal
        console.log('[Drive] Listing journal entries in folder:', folderId)

        // Query for .md files (don't filter by mimeType as it's unreliable)
        const query = `'${folderId}' in parents and name contains '.md' and trashed=false`
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,mimeType)`

        console.log('[Drive] Query:', query)

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[Drive] List files failed:', response.status, errorText)
            throw new Error('Failed to list files')
        }

        const data = await response.json()
        console.log('[Drive] Found files:', data.files?.length || 0, data.files)
        return data.files || []
    }, [getAccessToken, user, folders.journal, initializeFolders])

    // Save note (each note is a .md file with metadata in frontmatter)
    const saveNote = useCallback(async (note) => {
        if (user?.isDemo) {
            console.log('Demo mode - note saved locally only')
            return { id: `demo-${note.id}`, name: `${note.id}.md` }
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.notes || (await initializeFolders()).notes
        const fileName = `${note.id}.md`
        const cacheKey = `note:${note.id}`

        // Create markdown content with frontmatter metadata
        const content = `---
title: ${note.title}
folder: ${note.folder || 'root'}
createdAt: ${note.createdAt}
updatedAt: ${note.updatedAt}
---

${note.content}`

        // Wait for any pending save for this note to complete
        if (pendingSaves.current[cacheKey]) {
            await pendingSaves.current[cacheKey]
        }

        let fileId = fileIdCache.current[cacheKey]

        if (!fileId) {
            const existingFile = await findFile(token, fileName, folderId)
            if (existingFile) {
                fileId = existingFile.id
                fileIdCache.current[cacheKey] = fileId
            }
        }

        const savePromise = (async () => {
            try {
                if (fileId) {
                    return await updateFile(token, fileId, content)
                } else {
                    const newFile = await createFile(token, fileName, content, folderId, 'text/markdown')
                    fileIdCache.current[cacheKey] = newFile.id
                    return newFile
                }
            } finally {
                delete pendingSaves.current[cacheKey]
            }
        })()

        pendingSaves.current[cacheKey] = savePromise
        return savePromise
    }, [getAccessToken, user, folders.notes, initializeFolders])

    // Load single note
    const loadNote = useCallback(async (noteId) => {
        if (user?.isDemo) return null

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.notes || (await initializeFolders()).notes
        const fileName = `${noteId}.md`

        const file = await findFile(token, fileName, folderId)
        if (!file) return null

        const content = await downloadFile(token, file.id)
        return parseNoteContent(noteId, content)
    }, [getAccessToken, user, folders.notes, initializeFolders])

    // Delete note from Drive
    const deleteNoteFromDrive = useCallback(async (noteId) => {
        if (user?.isDemo) return

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.notes || (await initializeFolders()).notes
        const fileName = `${noteId}.md`
        const cacheKey = `note:${noteId}`

        const file = await findFile(token, fileName, folderId)
        if (file) {
            await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            delete fileIdCache.current[cacheKey]
        }
    }, [getAccessToken, user, folders.notes, initializeFolders])

    // List all notes
    const listNotes = useCallback(async () => {
        if (user?.isDemo) return []

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.notes || (await initializeFolders()).notes
        console.log('[Drive] Listing notes in folder:', folderId)

        const query = `'${folderId}' in parents and name contains '.md' and trashed=false`
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)`

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        })

        if (!response.ok) throw new Error('Failed to list notes')

        const data = await response.json()
        const files = data.files || []
        console.log('[Drive] Found notes:', files.length)

        // Load each note's content
        const notes = await Promise.all(files.map(async (file) => {
            const content = await downloadFile(token, file.id)
            const noteId = file.name.replace('.md', '')
            return parseNoteContent(noteId, content)
        }))

        return notes.filter(n => n !== null)
    }, [getAccessToken, user, folders.notes, initializeFolders])

    // Parse note content from markdown with frontmatter
    const parseNoteContent = (noteId, rawContent) => {
        if (!rawContent) return null

        const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/)
        if (!frontmatterMatch) {
            // No frontmatter, treat entire content as note content
            return {
                id: noteId,
                title: 'Untitled',
                content: rawContent,
                folder: 'root',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }

        const frontmatter = frontmatterMatch[1]
        const content = frontmatterMatch[2]

        const getValue = (key) => {
            const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
            return match ? match[1].trim() : null
        }

        return {
            id: noteId,
            title: getValue('title') || 'Untitled',
            content: content,
            folder: getValue('folder') || 'root',
            createdAt: getValue('createdAt') || new Date().toISOString(),
            updatedAt: getValue('updatedAt') || new Date().toISOString()
        }
    }

    // Save tasks
    const saveTasks = useCallback(async (tasks) => {
        if (user?.isDemo) {
            console.log('[Drive] Demo mode - tasks saved locally only')
            return
        }

        const token = getAccessToken()
        if (!token) {
            console.error('[Drive] saveTasks: Not authenticated')
            throw new Error('Not authenticated')
        }

        // Save tasks in user folder
        console.log('[Drive] Saving tasks...')
        const folderId = folders.user || (await initializeFolders()).user
        console.log('[Drive] Tasks folder ID:', folderId)

        const content = JSON.stringify({ tasks, lastModified: new Date().toISOString() }, null, 2)
        console.log('[Drive] Tasks content length:', content.length, 'tasks count:', tasks.length)

        const existingFile = await findFile(token, TASKS_FILE, folderId)
        console.log('[Drive] Existing tasks file:', existingFile)

        if (existingFile) {
            console.log('[Drive] Updating existing tasks file:', existingFile.id)
            const result = await updateFile(token, existingFile.id, content)
            console.log('[Drive] Tasks file updated:', result)
            return result
        } else {
            console.log('[Drive] Creating new tasks file in folder:', folderId)
            const result = await createFile(token, TASKS_FILE, content, folderId, 'application/json')
            console.log('[Drive] Tasks file created:', result)
            return result
        }
    }, [getAccessToken, user, folders.user, initializeFolders])

    // Load tasks
    const loadTasks = useCallback(async () => {
        if (user?.isDemo) {
            console.log('[Drive] Demo mode - no tasks to load')
            return null
        }

        const token = getAccessToken()
        if (!token) {
            console.error('[Drive] loadTasks: Not authenticated')
            throw new Error('Not authenticated')
        }

        // Load tasks from user folder
        console.log('[Drive] Loading tasks...')
        const folderId = folders.user || (await initializeFolders()).user
        console.log('[Drive] Looking for tasks in folder:', folderId)

        const file = await findFile(token, TASKS_FILE, folderId)
        console.log('[Drive] Tasks file found:', file)

        if (!file) {
            console.log('[Drive] No tasks file found')
            return null
        }

        const content = await downloadFile(token, file.id)
        console.log('[Drive] Tasks content loaded, length:', content.length)
        const parsed = JSON.parse(content)
        console.log('[Drive] Tasks loaded:', parsed.tasks?.length || 0, 'tasks')
        return parsed
    }, [getAccessToken, user, folders.user, initializeFolders])

    // Save metadata index to Drive
    const saveMetadata = useCallback(async (metadata) => {
        if (user?.isDemo) {
            console.log('[Drive] Demo mode - metadata saved locally only')
            return
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.user || (await initializeFolders()).user
        const content = JSON.stringify(metadata, null, 2)
        const cacheKey = 'metadata'

        let fileId = fileIdCache.current[cacheKey]
        if (!fileId) {
            const existingFile = await findFile(token, METADATA_FILE, folderId)
            if (existingFile) {
                fileId = existingFile.id
                fileIdCache.current[cacheKey] = fileId
            }
        }

        if (fileId) {
            await updateFile(token, fileId, content)
        } else {
            const newFile = await createFile(token, METADATA_FILE, content, folderId, 'application/json')
            fileIdCache.current[cacheKey] = newFile.id
        }

        console.log('[Drive] Metadata saved to Drive')
    }, [getAccessToken, user, folders.user, initializeFolders])

    // Load metadata index from Drive
    const loadMetadata = useCallback(async () => {
        if (user?.isDemo) return null

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.user || (await initializeFolders()).user
        const file = await findFile(token, METADATA_FILE, folderId)

        if (!file) {
            console.log('[Drive] No metadata file found')
            return null
        }

        const content = await downloadFile(token, file.id)
        console.log('[Drive] Metadata loaded from Drive')
        return JSON.parse(content)
    }, [getAccessToken, user, folders.user, initializeFolders])

    return {
        isLoading,
        error,
        initializeFolders,
        saveJournalEntry,
        loadJournalEntry,
        listJournalEntries,
        saveNote,
        loadNote,
        deleteNoteFromDrive,
        listNotes,
        saveTasks,
        loadTasks,
        saveMetadata,
        loadMetadata
    }
}

// Helper functions for Drive API
async function findFolder(token, name, parentId) {
    const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!response.ok) throw new Error('Failed to search folders')
    const data = await response.json()
    return data.files?.[0] || null
}

async function createFolder(token, name, parentId) {
    const metadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
    }

    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    })

    if (!response.ok) throw new Error('Failed to create folder')
    return await response.json()
}

async function findFile(token, name, folderId) {
    const query = `name='${name}' and '${folderId}' in parents and trashed=false`
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!response.ok) throw new Error('Failed to search files')
    const data = await response.json()
    return data.files?.[0] || null
}

async function createFile(token, name, content, folderId, mimeType) {
    const metadata = { name, parents: [folderId] }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', new Blob([content], { type: mimeType }))

    const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form
        }
    )

    if (!response.ok) throw new Error('Failed to create file')
    return await response.json()
}

async function updateFile(token, fileId, content) {
    const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            body: content
        }
    )

    if (!response.ok) throw new Error('Failed to update file')
    return await response.json()
}

async function downloadFile(token, fileId) {
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!response.ok) throw new Error('Failed to download file')
    return await response.text()
}

export default useGoogleDrive
