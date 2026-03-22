import { useState, useEffect, useCallback } from 'react'
import { Timeline } from './components/Timeline'
import { SystemPrompt } from './components/SystemPrompt'
import { ChatHistory } from './components/ChatHistory'
import { ToolHistory } from './components/ToolHistory'
import { StatusBar } from './components/StatusBar'
import { useJsonlParser } from './hooks/useJsonlParser'
import type { Turn, JsonlFile } from './types'

const LOGS_DIR = '.opencode/logs'

export default function App() {
  const [files, setFiles] = useState<JsonlFile[]>([])
  const [currentFile, setCurrentFile] = useState<JsonlFile | null>(null)
  const [currentTurn, setCurrentTurn] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const { parseContent } = useJsonlParser()

  // Load files from default directory
  useEffect(() => {
    loadDefaultLogs()
  }, [])

  const loadDefaultLogs = async () => {
    try {
      const response = await fetch(`file://${process.cwd()}/${LOGS_DIR}`)
      // For browser, we'll use a different approach
    } catch (e) {
      // Fallback: user will drag files
    }
  }

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.jsonl')) {
      loadFile(file)
    }
  }, [parseContent])

  const loadFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const parsed = parseContent(content)
      parsed.filename = file.name
      parsed.filepath = file.name
      setCurrentFile(parsed)
      setCurrentTurn(1)
    }
    reader.readAsText(file)
  }

  const currentTurnData = currentFile?.turns.find(
    t => t.turnStart.turn === currentTurn
  )

  const handlePrevTurn = () => {
    if (currentTurn > 1) setCurrentTurn(currentTurn - 1)
  }

  const handleNextTurn = () => {
    if (currentFile && currentTurn < currentFile.turns.length) {
      setCurrentTurn(currentTurn + 1)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevTurn()
      if (e.key === 'ArrowRight') handleNextTurn()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTurn, currentFile])

  return (
    <>
      <header className="header">
        <div className="header-left">
          <span className="header-title">
            {currentFile ? currentFile.filename : 'LLM Log Visualizer'}
          </span>
        </div>
        <div className="header-right">
          <button
            className="nav-btn"
            onClick={handlePrevTurn}
            disabled={!currentFile || currentTurn <= 1}
          >
            ←
          </button>
          <span className="turn-indicator">
            {currentFile ? `Turn ${currentTurn} / ${currentFile.turns.length}` : '-'}
          </span>
          <button
            className="nav-btn"
            onClick={handleNextTurn}
            disabled={!currentFile || currentTurn >= (currentFile?.turns.length || 1)}
          >
            →
          </button>
        </div>
      </header>

      <div
        className="app-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="main-content">
          <div className="timeline-column">
            {currentFile && (
              <>
                <Timeline
                  turns={currentFile.turns}
                  currentTurn={currentTurn}
                  onSelectTurn={setCurrentTurn}
                />
              </>
            )}
          </div>

          {currentTurnData ? (
            <div className="content-columns">
              <SystemPrompt turn={currentTurnData} />
              <div className="history-column">
                <ChatHistory turn={currentTurnData} />
                <ToolHistory turn={currentTurnData} />
              </div>
            </div>
          ) : (
            <div className="content-columns" style={{ alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
                <div>Drag & drop a .jsonl file here</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  or use keyboard ← → to navigate
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {currentTurnData && currentFile && (
        <StatusBar
          turn={currentTurnData}
          currentTurn={currentTurn}
          totalTurns={currentFile.turns.length}
        />
      )}

      {isDragging && (
        <div className="drop-zone">
          <div className="drop-zone-text">Drop .jsonl file here</div>
        </div>
      )}
    </>
  )
}
