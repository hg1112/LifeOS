import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Initialize theme from localStorage or system preference
const savedTheme = localStorage.getItem('lifeos-theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light')
document.documentElement.setAttribute('data-theme', initialTheme)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
