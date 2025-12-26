import { useState, useCallback, useRef } from 'react'
import { useGoogleAuth } from './useGoogleAuth'

const FOLDER_NAME = 'LifeOS'
const JOURNAL_FOLDER = 'journal'
const TASKS_FILE = 'tasks.json'
const SETTINGS_FILE = 'settings.json'

export function useGoogleDrive() {
    const { getAccessToken, user } = useGoogleAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [folders, setFolders] = useState({
        root: null,
        journal: null
    })

    // Cache for file IDs to prevent duplicate creation (race condition fix)
    const fileIdCache = useRef({})
    // Track pending saves to prevent concurrent creates
    const pendingSaves = useRef({})

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

            // Find or create journal subfolder
            console.log('[Drive] Looking for journal folder in', rootFolder.id)
            let journalFolder = await findFolder(token, JOURNAL_FOLDER, rootFolder.id)
            console.log('[Drive] Journal folder result:', journalFolder)
            if (!journalFolder) {
                console.log('[Drive] Creating journal folder...')
                journalFolder = await createFolder(token, JOURNAL_FOLDER, rootFolder.id)
            }

            const folderIds = {
                root: rootFolder.id,
                journal: journalFolder.id
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

    // Save tasks
    const saveTasks = useCallback(async (tasks) => {
        if (user?.isDemo) {
            console.log('Demo mode - tasks saved locally only')
            return
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.root || (await initializeFolders()).root
        const content = JSON.stringify({ tasks, lastModified: new Date().toISOString() }, null, 2)

        const existingFile = await findFile(token, TASKS_FILE, folderId)

        if (existingFile) {
            return await updateFile(token, existingFile.id, content)
        } else {
            return await createFile(token, TASKS_FILE, content, folderId, 'application/json')
        }
    }, [getAccessToken, user, folders.root, initializeFolders])

    // Load tasks
    const loadTasks = useCallback(async () => {
        if (user?.isDemo) {
            return null
        }

        const token = getAccessToken()
        if (!token) throw new Error('Not authenticated')

        const folderId = folders.root || (await initializeFolders()).root
        const file = await findFile(token, TASKS_FILE, folderId)

        if (!file) return null

        const content = await downloadFile(token, file.id)
        return JSON.parse(content)
    }, [getAccessToken, user, folders.root, initializeFolders])

    return {
        isLoading,
        error,
        initializeFolders,
        saveJournalEntry,
        loadJournalEntry,
        listJournalEntries,
        saveTasks,
        loadTasks
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
