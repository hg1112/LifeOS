import { useState, useEffect, createContext, useCallback, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/Layout/AppLayout'
import Journal from './pages/Journal'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { useGoogleAuth } from './hooks/useGoogleAuth'
import { useGoogleDrive } from './hooks/useGoogleDrive'
import './App.css'

// Create contexts
export const AuthContext = createContext(null)
export const ThemeContext = createContext(null)
export const DataContext = createContext(null)

function App() {
  const [theme, setTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'light'
  })

  const { user, isLoading, isAuthenticated, signIn, signOut } = useGoogleAuth()
  const {
    saveJournalEntry,
    loadJournalEntry,
    listJournalEntries,
    saveTasks,
    loadTasks,
    initializeFolders,
    isLoading: isDriveLoading,
    error: driveError
  } = useGoogleDrive()

  // Journal, tasks, notes, and drawings data state
  const [journalEntries, setJournalEntries] = useState({})
  const [tasks, setTasks] = useState([])
  const [notes, setNotes] = useState([])
  const [drawings, setDrawings] = useState([])
  const [syncStatus, setSyncStatus] = useState('idle')
  const [dataLoaded, setDataLoaded] = useState(false)

  // Track dirty state for change detection
  const [dirtyJournals, setDirtyJournals] = useState(new Set())
  const [tasksDirty, setTasksDirty] = useState(false)

  // Store original content for comparison
  const originalJournalContentRef = useRef({})
  const originalTasksRef = useRef(null)

  // Refs for debouncing
  const journalSaveTimeoutRef = useRef({})
  const tasksSaveTimeoutRef = useRef(null)

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('lifeos-theme', newTheme)
  }

  // Load data from Google Drive on startup
  useEffect(() => {
    const loadDataFromDrive = async () => {
      if (!isAuthenticated || user?.isDemo || dataLoaded) return

      try {
        setSyncStatus('syncing')

        // Initialize Drive folders
        await initializeFolders()

        // Load journal entries
        const entries = await listJournalEntries()
        if (entries && entries.length > 0) {
          const journalData = {}
          for (const entry of entries) {
            const date = entry.name.replace('.md', '')
            const content = await loadJournalEntry(date)
            if (content) {
              journalData[date] = {
                date,
                content,
                lastModified: entry.modifiedTime
              }
              // Store original content for change detection
              originalJournalContentRef.current[date] = content
            }
          }
          if (Object.keys(journalData).length > 0) {
            setJournalEntries(journalData)
          }
        }

        // Load tasks
        const tasksData = await loadTasks()
        if (tasksData?.tasks) {
          setTasks(tasksData.tasks)
          // Store original tasks for change detection
          originalTasksRef.current = JSON.stringify(tasksData.tasks)
        }

        setDataLoaded(true)
        setSyncStatus('synced')
      } catch (error) {
        console.error('Error loading data from Drive:', error)
        setSyncStatus('error')
        // Still mark as loaded so we don't keep retrying
        setDataLoaded(true)
      }
    }

    loadDataFromDrive()
  }, [isAuthenticated, user, dataLoaded, initializeFolders, listJournalEntries, loadJournalEntry, loadTasks])

  // Load demo data if not authenticated or in demo mode
  useEffect(() => {
    if (dataLoaded) return
    if (isLoading) return
    if (isAuthenticated && !user?.isDemo) return // Will load from Drive

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const demoJournals = {
      [today]: {
        date: today,
        content: `# ${formatDate(today)}\n\nWelcome to LifeOS Journal! Start writing your thoughts here...\n\n## Today's Focus\n- \n\n## Notes\n`,
        lastModified: new Date().toISOString()
      },
      [yesterday]: {
        date: yesterday,
        content: `# ${formatDate(yesterday)}\n\nThis is a sample entry from yesterday.\n\n## Accomplishments\n- Set up LifeOS Journal\n- Started my journaling habit\n`,
        lastModified: new Date(Date.now() - 86400000).toISOString()
      }
    }

    const demoTasks = [
      { id: '1', title: 'Set up Google Cloud Project', completed: false, dueDate: today, priority: 'high', status: 'backlog', createdAt: new Date().toISOString() },
      { id: '2', title: 'Connect Google Drive for backup', completed: false, dueDate: null, priority: 'medium', status: 'backlog', createdAt: new Date().toISOString() },
      { id: '3', title: 'Write in journal daily', completed: false, dueDate: null, priority: 'low', status: 'backlog', createdAt: new Date().toISOString() }
    ]

    setJournalEntries(demoJournals)
    setTasks(demoTasks)

    // Store originals
    Object.entries(demoJournals).forEach(([date, entry]) => {
      originalJournalContentRef.current[date] = entry.content
    })
    originalTasksRef.current = JSON.stringify(demoTasks)

    setNotes([
      { id: '1', title: 'Welcome to Notes', content: '# Welcome to Notes\n\nThis is your free-form note-taking space!\n\n## Features\n- Create folders to organize notes\n- Write in markdown\n- Search across all notes\n\n## Tips\n- Use **bold** and *italic* for emphasis\n- Create lists with - or 1.\n- Add links with [text](url)', folder: 'root', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', title: 'Project Ideas', content: '# Project Ideas\n\n## App Ideas\n- Habit tracker\n- Recipe manager\n- Budget planner\n\n## Learning\n- React Native\n- Machine Learning', folder: 'Projects', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ])

    setDataLoaded(true)
  }, [isLoading, isAuthenticated, user, dataLoaded])

  // Auto-save journal entry to Drive (debounced)
  const saveJournalToDrive = useCallback(async (date, content) => {
    if (!isAuthenticated || user?.isDemo) return

    try {
      await saveJournalEntry(date, content)
      // Update original content after successful save
      originalJournalContentRef.current[date] = content
      setDirtyJournals(prev => {
        const next = new Set(prev)
        next.delete(date)
        return next
      })
      setSyncStatus('synced')
    } catch (error) {
      console.error('Error saving journal to Drive:', error)
      setSyncStatus('error')
    }
  }, [isAuthenticated, user, saveJournalEntry])

  // Auto-save tasks to Drive (debounced)
  const saveTasksToDrive = useCallback(async (tasksToSave) => {
    if (!isAuthenticated || user?.isDemo) return

    try {
      await saveTasks(tasksToSave)
      // Update original tasks after successful save
      originalTasksRef.current = JSON.stringify(tasksToSave)
      setTasksDirty(false)
      setSyncStatus('synced')
    } catch (error) {
      console.error('Error saving tasks to Drive:', error)
      setSyncStatus('error')
    }
  }, [isAuthenticated, user, saveTasks])

  // Journal operations with auto-sync (only if changed)
  const updateJournalEntry = useCallback((date, content) => {
    setJournalEntries(prev => ({
      ...prev,
      [date]: { date, content, lastModified: new Date().toISOString() }
    }))

    // Check if content actually changed
    const originalContent = originalJournalContentRef.current[date] || ''
    if (content === originalContent) {
      return // No change, don't sync
    }

    // Mark as dirty and sync
    setDirtyJournals(prev => new Set(prev).add(date))
    setSyncStatus('syncing')

    // Debounce save to Drive (1 second delay)
    if (journalSaveTimeoutRef.current[date]) {
      clearTimeout(journalSaveTimeoutRef.current[date])
    }
    journalSaveTimeoutRef.current[date] = setTimeout(() => {
      saveJournalToDrive(date, content)
    }, 1000)
  }, [saveJournalToDrive])

  // Task operations with auto-sync (only if changed)
  const syncTasksToDriver = useCallback((newTasks) => {
    // Check if tasks actually changed
    const newTasksJson = JSON.stringify(newTasks)
    if (newTasksJson === originalTasksRef.current) {
      return // No change, don't sync
    }

    setTasksDirty(true)
    setSyncStatus('syncing')

    if (tasksSaveTimeoutRef.current) {
      clearTimeout(tasksSaveTimeoutRef.current)
    }
    tasksSaveTimeoutRef.current = setTimeout(() => {
      saveTasksToDrive(newTasks)
    }, 1000)
  }, [saveTasksToDrive])

  // Force sync all dirty data immediately
  const forceSync = useCallback(async () => {
    if (!isAuthenticated || user?.isDemo) {
      setSyncStatus('synced')
      return
    }

    setSyncStatus('syncing')

    try {
      // Cancel any pending debounced saves
      Object.values(journalSaveTimeoutRef.current).forEach(clearTimeout)
      journalSaveTimeoutRef.current = {}
      if (tasksSaveTimeoutRef.current) {
        clearTimeout(tasksSaveTimeoutRef.current)
        tasksSaveTimeoutRef.current = null
      }

      // Save all dirty journals
      for (const date of dirtyJournals) {
        const entry = journalEntries[date]
        if (entry) {
          await saveJournalEntry(date, entry.content)
          originalJournalContentRef.current[date] = entry.content
        }
      }
      setDirtyJournals(new Set())

      // Save tasks if dirty
      if (tasksDirty) {
        await saveTasks(tasks)
        originalTasksRef.current = JSON.stringify(tasks)
        setTasksDirty(false)
      }

      setSyncStatus('synced')
    } catch (error) {
      console.error('Error during force sync:', error)
      setSyncStatus('error')
    }
  }, [isAuthenticated, user, dirtyJournals, journalEntries, tasksDirty, tasks, saveJournalEntry, saveTasks])

  // Check if there are unsaved changes
  const hasUnsavedChanges = dirtyJournals.size > 0 || tasksDirty

  const addTask = useCallback((task) => {
    const newTask = { id: Date.now().toString(), ...task, completed: false, createdAt: new Date().toISOString() }
    setTasks(prev => {
      const newTasks = [newTask, ...prev]
      syncTasksToDriver(newTasks)
      return newTasks
    })
  }, [syncTasksToDriver])

  const updateTask = useCallback((id, updates) => {
    setTasks(prev => {
      const newTasks = prev.map(task => task.id === id ? { ...task, ...updates } : task)
      syncTasksToDriver(newTasks)
      return newTasks
    })
  }, [syncTasksToDriver])

  const deleteTask = useCallback((id) => {
    setTasks(prev => {
      const newTasks = prev.filter(task => task.id !== id)
      syncTasksToDriver(newTasks)
      return newTasks
    })
  }, [syncTasksToDriver])

  const toggleTask = useCallback((id) => {
    setTasks(prev => {
      const newTasks = prev.map(task => task.id === id ? { ...task, completed: !task.completed } : task)
      syncTasksToDriver(newTasks)
      return newTasks
    })
  }, [syncTasksToDriver])

  // Notes operations
  const addNote = (note) => {
    setNotes(prev => [note, ...prev])
  }

  const updateNote = (id, updates) => {
    setNotes(prev => prev.map(note => note.id === id ? { ...note, ...updates } : note))
  }

  const deleteNote = (id) => {
    setNotes(prev => prev.filter(note => note.id !== id))
  }

  // Drawings operations
  const saveDrawing = (drawing) => {
    setDrawings(prev => {
      const existing = prev.findIndex(d => d.id === drawing.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = drawing
        return updated
      }
      return [drawing, ...prev]
    })
  }

  const loadDrawing = (id) => {
    return drawings.find(d => d.id === id)
  }

  const deleteDrawing = (id) => {
    setDrawings(prev => prev.filter(d => d.id !== id))
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, signIn, signOut }}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <DataContext.Provider value={{
          journalEntries,
          updateJournalEntry,
          tasks,
          addTask,
          updateTask,
          deleteTask,
          toggleTask,
          notes,
          addNote,
          updateNote,
          deleteNote,
          drawings,
          saveDrawing,
          loadDrawing,
          deleteDrawing,
          syncStatus,
          isDriveLoading,
          driveError,
          forceSync,
          hasUnsavedChanges
        }}>
          <Routes>
            <Route path="/login" element={
              isAuthenticated ? <Navigate to="/" replace /> : <Login />
            } />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/journal" replace />} />
              <Route path="journal" element={<Journal />} />
              <Route path="journal/:date" element={<Journal />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="notes" element={<Notes />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </DataContext.Provider>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  )
}

function formatDate(dateString) {
  const date = new Date(dateString + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default App
