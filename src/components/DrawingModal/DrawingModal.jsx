import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import './DrawingModal.css'

// Lazy load Excalidraw
const Excalidraw = lazy(() =>
    import('@excalidraw/excalidraw').then(module => ({ default: module.Excalidraw }))
)

function DrawingModal({ isOpen, onClose, onSave, initialData }) {
    const [excalidrawAPI, setExcalidrawAPI] = useState(null)
    const [isEditing] = useState(!!initialData)

    // Load initial data when editing
    useEffect(() => {
        if (initialData && excalidrawAPI) {
            try {
                excalidrawAPI.updateScene({
                    elements: initialData.elements || [],
                    appState: initialData.appState || {}
                })
            } catch (e) {
                console.error('Failed to load drawing:', e)
            }
        }
    }, [initialData, excalidrawAPI])

    const handleSave = async () => {
        if (!excalidrawAPI) return

        try {
            // Get current scene elements
            const sceneElements = excalidrawAPI.getSceneElements()
            const appState = excalidrawAPI.getAppState()

            // Export as PNG blob
            const blob = await excalidrawAPI.exportToBlob({
                mimeType: 'image/png',
                quality: 0.9,
            })

            // Convert to base64
            const reader = new FileReader()
            reader.onloadend = () => {
                const base64Image = reader.result

                // Save both the image and the scene data for future editing
                onSave({
                    id: initialData?.id || `drawing_${Date.now()}`,
                    image: base64Image,
                    elements: sceneElements,
                    appState: {
                        viewBackgroundColor: appState.viewBackgroundColor,
                        zoom: appState.zoom,
                        scrollX: appState.scrollX,
                        scrollY: appState.scrollY,
                    },
                    updatedAt: new Date().toISOString()
                })
                onClose()
            }
            reader.readAsDataURL(blob)
        } catch (error) {
            console.error('Failed to export drawing:', error)
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="drawing-modal-overlay" onClick={onClose}>
            <div className="drawing-modal" onClick={e => e.stopPropagation()}>
                <div className="drawing-modal-header">
                    <h2>{isEditing ? '✏️ Edit Drawing' : '✏️ Create Drawing'}</h2>
                    <div className="drawing-modal-actions">
                        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave}>
                            {isEditing ? 'Update Drawing' : 'Insert Drawing'}
                        </button>
                    </div>
                </div>

                <div className="drawing-canvas-container">
                    <Suspense fallback={<div className="loading-canvas">Loading drawing canvas...</div>}>
                        <Excalidraw
                            excalidrawAPI={(api) => setExcalidrawAPI(api)}
                            theme="dark"
                            initialData={{
                                elements: initialData?.elements || [],
                                appState: {
                                    viewBackgroundColor: '#1e1e2e',
                                    ...(initialData?.appState || {})
                                },
                                libraryItems: []
                            }}
                            UIOptions={{
                                canvasActions: {
                                    loadScene: false,
                                    saveAsImage: false,
                                    export: false,
                                    clearCanvas: true,
                                },
                                tools: {
                                    image: false,
                                },
                            }}
                            libraryReturnUrl=""
                        />
                    </Suspense>
                </div>
            </div>
        </div>
    )
}

export default DrawingModal
