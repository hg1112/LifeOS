import { useState, useContext, useCallback, lazy, Suspense } from 'react'
import { DataContext } from '../App'
import './Draw.css'

// Lazy load Excalidraw to prevent SSR issues
const Excalidraw = lazy(() =>
    import('@excalidraw/excalidraw').then(module => ({ default: module.Excalidraw }))
)

function Draw() {
    const { drawings, saveDrawing } = useContext(DataContext)
    const [currentDrawing, setCurrentDrawing] = useState(null)
    const [drawingName, setDrawingName] = useState('Untitled')
    const [showSidebar, setShowSidebar] = useState(true)
    const [excalidrawAPI, setExcalidrawAPI] = useState(null)
    const [error, setError] = useState(null)

    const drawingList = drawings || []

    const handleChange = useCallback((elements, appState) => {
        setCurrentDrawing({ elements, appState })
    }, [])

    const handleSave = () => {
        if (!currentDrawing) return
        const id = Date.now().toString()
        saveDrawing({
            id,
            name: drawingName || 'Untitled',
            elements: currentDrawing.elements,
            appState: currentDrawing.appState,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
    }

    const handleLoadDrawing = (drawing) => {
        setDrawingName(drawing.name)
        if (excalidrawAPI) {
            excalidrawAPI.updateScene({
                elements: drawing.elements,
                appState: drawing.appState
            })
        }
    }

    const handleNewDrawing = () => {
        setDrawingName('Untitled')
        if (excalidrawAPI) {
            excalidrawAPI.resetScene()
        }
    }

    if (error) {
        return (
            <div className="draw-page">
                <div className="draw-error">
                    <h2>⚠️ Drawing Error</h2>
                    <p>Failed to load drawing canvas: {error.message}</p>
                    <button className="btn btn-primary" onClick={() => window.location.reload()}>
                        Reload Page
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="draw-page">
            {/* Sidebar */}
            {showSidebar && (
                <aside className="draw-sidebar">
                    <div className="draw-sidebar-header">
                        <h2>Drawings</h2>
                        <button className="btn btn-primary btn-sm" onClick={handleNewDrawing}>+ New</button>
                    </div>

                    <div className="drawing-list">
                        {drawingList.length === 0 ? (
                            <div className="empty-drawings">
                                <p>No saved drawings</p>
                                <p className="hint">Draw something and save it!</p>
                            </div>
                        ) : (
                            drawingList.map(drawing => (
                                <button key={drawing.id} className="drawing-item" onClick={() => handleLoadDrawing(drawing)}>
                                    <span className="drawing-icon">🎨</span>
                                    <div className="drawing-info">
                                        <span className="drawing-name">{drawing.name}</span>
                                        <span className="drawing-date">{new Date(drawing.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </aside>
            )}

            {/* Canvas */}
            <main className="draw-canvas">
                <header className="draw-header">
                    <div className="header-left">
                        <button className="btn btn-ghost btn-icon" onClick={() => setShowSidebar(!showSidebar)} title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}>
                            {showSidebar ? '◀' : '▶'}
                        </button>
                        <input
                            type="text"
                            className="drawing-name-input"
                            value={drawingName}
                            onChange={(e) => setDrawingName(e.target.value)}
                            placeholder="Drawing name..."
                        />
                    </div>
                    <div className="header-right">
                        <button className="btn btn-primary" onClick={handleSave}>💾 Save</button>
                    </div>
                </header>

                <div className="excalidraw-wrapper">
                    <Suspense fallback={<div className="loading-canvas">Loading drawing canvas...</div>}>
                        <Excalidraw
                            onChange={handleChange}
                            excalidrawAPI={(api) => setExcalidrawAPI(api)}
                            theme="dark"
                            UIOptions={{
                                canvasActions: {
                                    loadScene: false,
                                    export: { saveFileToDisk: true },
                                },
                            }}
                        />
                    </Suspense>
                </div>
            </main>
        </div>
    )
}

export default Draw
