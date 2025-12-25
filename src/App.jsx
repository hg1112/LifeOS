import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/Layout/AppLayout'
import Journal from './pages/Journal'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { useGoogleAuth } from './hooks/useGoogleAuth'
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

  // Journal, tasks, notes, and drawings data state
  const [journalEntries, setJournalEntries] = useState({})
  const [tasks, setTasks] = useState([])
  const [notes, setNotes] = useState([])
  const [drawings, setDrawings] = useState([])
  const [syncStatus, setSyncStatus] = useState('idle')

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('lifeos-theme', newTheme)
  }

  // Load demo data
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    setJournalEntries({
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
    })

    setTasks([
      { id: '1', title: 'Set up Google Cloud Project', completed: false, dueDate: today, priority: 'high', status: 'backlog', createdAt: new Date().toISOString() },
      { id: '2', title: 'Connect Google Drive for backup', completed: false, dueDate: null, priority: 'medium', status: 'backlog', createdAt: new Date().toISOString() },
      { id: '3', title: 'Write in journal daily', completed: false, dueDate: null, priority: 'low', status: 'backlog', createdAt: new Date().toISOString() }
    ])

    setNotes([
      { id: '1', title: 'Welcome to Notes', content: '# Welcome to Notes\n\nThis is your free-form note-taking space!\n\n## Features\n- Create folders to organize notes\n- Write in markdown\n- Search across all notes\n\n## Tips\n- Use **bold** and *italic* for emphasis\n- Create lists with - or 1.\n- Add links with [text](url)', folder: 'root', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', title: 'Project Ideas', content: '# Project Ideas\n\n## App Ideas\n- Habit tracker\n- Recipe manager\n- Budget planner\n\n## Learning\n- React Native\n- Machine Learning', folder: 'Projects', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ])
  }, [])

  // Journal operations
  const updateJournalEntry = (date, content) => {
    setJournalEntries(prev => ({
      ...prev,
      [date]: { date, content, lastModified: new Date().toISOString() }
    }))
    setSyncStatus('syncing')
    setTimeout(() => setSyncStatus('synced'), 500)
  }

  // Task operations
  const addTask = (task) => {
    const newTask = { id: Date.now().toString(), ...task, completed: false, createdAt: new Date().toISOString() }
    setTasks(prev => [newTask, ...prev])
  }

  const updateTask = (id, updates) => {
    setTasks(prev => prev.map(task => task.id === id ? { ...task, ...updates } : task))
  }

  const deleteTask = (id) => {
    setTasks(prev => prev.filter(task => task.id !== id))
  }

  const toggleTask = (id) => {
    setTasks(prev => prev.map(task => task.id === id ? { ...task, completed: !task.completed } : task))
  }

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
          syncStatus
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
