import Dexie from 'dexie'

// Create IndexedDB database using Dexie
const db = new Dexie('LifeOSDB')

// Database schema - version 1
db.version(1).stores({
    // Notes table with indexed fields
    notes: 'id, title, folder, createdAt, updatedAt',

    // Tasks table with indexed fields  
    tasks: 'id, title, priority, status, dueDate, completed, createdAt',

    // Journal entries indexed by date
    journal: 'date, lastModified',

    // Sync metadata (for tracking sync state)
    syncMeta: 'key'
})

// Export database instance
export default db

// Helper to get all searchable content
export async function getAllSearchableContent() {
    const [notes, tasks, journal] = await Promise.all([
        db.notes.toArray(),
        db.tasks.toArray(),
        db.journal.toArray()
    ])

    return {
        notes: notes.map(n => ({
            id: n.id,
            type: 'note',
            title: n.title,
            content: n.content,
            folder: n.folder,
            updatedAt: n.updatedAt
        })),
        tasks: tasks.map(t => ({
            id: t.id,
            type: 'task',
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
            dueDate: t.dueDate
        })),
        journal: journal.map(j => ({
            id: j.date,
            type: 'journal',
            title: j.date,
            content: j.content,
            date: j.date
        }))
    }
}

// Helper to export metadata for Drive sync
export async function exportMetadata() {
    const [notes, tasks, journal, syncMeta] = await Promise.all([
        db.notes.toArray(),
        db.tasks.toArray(),
        db.journal.toArray(),
        db.syncMeta.get('lastSync')
    ])

    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        lastSync: syncMeta?.value,
        notes: notes.map(n => ({
            id: n.id,
            title: n.title,
            folder: n.folder,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
            // Include content for full-text search
            contentPreview: n.content?.substring(0, 500) || ''
        })),
        tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
            dueDate: t.dueDate,
            completed: t.completed,
            createdAt: t.createdAt
        })),
        journal: journal.map(j => ({
            date: j.date,
            lastModified: j.lastModified,
            // Include content preview for search
            contentPreview: j.content?.substring(0, 500) || ''
        }))
    }
}

// Helper to import metadata from Drive
export async function importMetadata(metadata) {
    if (!metadata) return

    // Clear existing data
    await Promise.all([
        db.notes.clear(),
        db.tasks.clear(),
        db.journal.clear()
    ])

    // Import data
    if (metadata.notes?.length > 0) {
        await db.notes.bulkPut(metadata.notes.map(n => ({
            ...n,
            content: n.contentPreview || ''
        })))
    }

    if (metadata.tasks?.length > 0) {
        await db.tasks.bulkPut(metadata.tasks)
    }

    if (metadata.journal?.length > 0) {
        await db.journal.bulkPut(metadata.journal.map(j => ({
            ...j,
            content: j.contentPreview || ''
        })))
    }

    // Update sync timestamp
    await db.syncMeta.put({ key: 'lastSync', value: new Date().toISOString() })
}
