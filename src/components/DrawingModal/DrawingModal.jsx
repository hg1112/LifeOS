import { useRef, useState } from 'react'
import { ReactSketchCanvas } from 'react-sketch-canvas'
import './DrawingModal.css'

function DrawingModal({ isOpen, onClose, onSave, initialData }) {
    const canvasRef = useRef(null)
    const [isEditing] = useState(!!initialData)
    const [strokeColor, setStrokeColor] = useState('#ffffff')
    const [strokeWidth, setStrokeWidth] = useState(4)
    const [eraserMode, setEraserMode] = useState(false)

    const colors = [
        '#ffffff', '#ef4444', '#f97316', '#eab308',
        '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'
    ]

    const handleSave = async () => {
        if (!canvasRef.current) return

        try {
            // Export as base64 PNG
            const base64Image = await canvasRef.current.exportImage('png')

            // Get the drawing paths for future editing
            const paths = await canvasRef.current.exportPaths()

            onSave({
                id: initialData?.id || `drawing_${Date.now()}`,
                image: base64Image,
                paths: paths,
                updatedAt: new Date().toISOString()
            })
            onClose()
        } catch (error) {
            console.error('Failed to export drawing:', error)
            onClose()
        }
    }

    const handleClear = () => {
        canvasRef.current?.clearCanvas()
    }

    const handleUndo = () => {
        canvasRef.current?.undo()
    }

    const handleRedo = () => {
        canvasRef.current?.redo()
    }

    const toggleEraser = () => {
        if (eraserMode) {
            canvasRef.current?.eraseMode(false)
            setEraserMode(false)
        } else {
            canvasRef.current?.eraseMode(true)
            setEraserMode(true)
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

                {/* Toolbar */}
                <div className="drawing-toolbar">
                    <div className="color-palette">
                        {colors.map(color => (
                            <button
                                key={color}
                                className={`color-btn ${strokeColor === color ? 'active' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    setStrokeColor(color)
                                    setEraserMode(false)
                                    canvasRef.current?.eraseMode(false)
                                }}
                            />
                        ))}
                    </div>

                    <div className="toolbar-divider" />

                    <div className="stroke-width">
                        <label>Size:</label>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={strokeWidth}
                            onChange={(e) => setStrokeWidth(Number(e.target.value))}
                        />
                        <span>{strokeWidth}px</span>
                    </div>

                    <div className="toolbar-divider" />

                    <button
                        className={`tool-btn ${eraserMode ? 'active' : ''}`}
                        onClick={toggleEraser}
                        title="Eraser"
                    >
                        🧹
                    </button>
                    <button className="tool-btn" onClick={handleUndo} title="Undo">↩️</button>
                    <button className="tool-btn" onClick={handleRedo} title="Redo">↪️</button>
                    <button className="tool-btn" onClick={handleClear} title="Clear">🗑️</button>
                </div>

                <div className="drawing-canvas-container">
                    <ReactSketchCanvas
                        ref={canvasRef}
                        width="100%"
                        height="100%"
                        strokeWidth={strokeWidth}
                        strokeColor={strokeColor}
                        canvasColor="#1e1e2e"
                        exportWithBackgroundImage={true}
                        style={{
                            border: 'none',
                            borderRadius: '8px'
                        }}
                    />
                </div>
            </div>
        </div>
    )
}

export default DrawingModal
