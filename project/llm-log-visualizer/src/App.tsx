import { useState, useEffect, useCallback, useRef } from 'react'
import { useJsonlParser } from './hooks/useJsonlParser'
import type { JsonlFile } from './types'

interface LoadedFile {
  filename: string
  data: JsonlFile
}

export default function App() {
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [currentTurn, setCurrentTurn] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [systemPaneWidth, setSystemPaneWidth] = useState(35) // percentage
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set())
  const { parseContent } = useJsonlParser()
  const resizeRef = useRef<HTMLDivElement>(null)

  const currentFile = loadedFiles[currentFileIndex]?.data

  const loadFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const parsed = parseContent(content)
      parsed.filename = file.name
      parsed.filepath = file.name

      const newFile: LoadedFile = { filename: file.name, data: parsed }

      setLoadedFiles(prev => {
        const existingIndex = prev.findIndex(f => f.filename === file.name)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = newFile
          return updated
        }
        return [...prev, newFile]
      })

      setCurrentFileIndex(() => {
        const newIndex = loadedFiles.findIndex(f => f.filename === file.name)
        return newIndex >= 0 ? newIndex : loadedFiles.length
      })
      setCurrentTurn(1)
      setExpandedTools(new Set())
    }
    reader.readAsText(file)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++

    // Clear any pending hide
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current)
      dragTimeoutRef.current = null
    }

    // Only show after a small delay to prevent flickering
    if (!isDragging) {
      dragTimeoutRef.current = setTimeout(() => {
        setIsDragging(true)
      }, 50)
    }
  }, [isDragging])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0

      // Delay hiding to prevent flickering when moving over child elements
      dragTimeoutRef.current = setTimeout(() => {
        setIsDragging(false)
      }, 100)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current)
      dragTimeoutRef.current = null
    }

    dragCounterRef.current = 0
    setIsDragging(false)
    const files = e.dataTransfer.files
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.name.endsWith('.jsonl')) {
        loadFile(file)
      }
    }
  }, [parseContent])

  const currentView = currentFile?.cachedViews[currentTurn - 1]

  const handlePrevTurn = () => {
    if (currentTurn > 1) {
      setCurrentTurn(currentTurn - 1)
      setExpandedTools(new Set())
    }
  }

  const handleNextTurn = () => {
    if (currentFile && currentTurn < currentFile.turns.length) {
      setCurrentTurn(currentTurn + 1)
      setExpandedTools(new Set())
    }
  }

  const toggleTool = (index: number) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // 判断某个 tool index 是否属于当前 turn
  // toolCalls 是从当前 turn 向下累积的倒序数组
  const getToolTurnInfo = (toolIndex: number): { isCurrentTurn: boolean; turnLabel: string } => {
    const totalTools = currentView?.toolCalls?.length || 0
    if (totalTools === 0) return { isCurrentTurn: false, turnLabel: '' }

    // 从后往前计算每个 turn 的 tool 数量，确定该 index 属于哪个 turn
    let accumulated = 0
    for (let t = 1; t <= currentTurn; t++) {
      const turnToolCount = currentFile?.turns[t - 1]?.turnComplete?.toolCalls?.length || 0
      const start = accumulated
      const end = accumulated + turnToolCount

      if (toolIndex >= start && toolIndex < end) {
        return {
          isCurrentTurn: t === currentTurn,
          turnLabel: t === currentTurn ? '' : `Turn ${t}`
        }
      }
      accumulated += turnToolCount
    }

    // 默认返回当前 turn（理论上不应该走到这里）
    return { isCurrentTurn: true, turnLabel: '' }
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

  // Prevent default browser drag behaviors
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault()
    document.addEventListener('dragover', preventDefault)
    document.addEventListener('drop', preventDefault)
    return () => {
      document.removeEventListener('dragover', preventDefault)
      document.removeEventListener('drop', preventDefault)
    }
  }, [])

  // Pane resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = systemPaneWidth

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.content-panes') as HTMLElement
      if (!container) return
      const containerWidth = container.offsetWidth
      const delta = ((e.clientX - startX) / containerWidth) * 100
      const newWidth = Math.min(Math.max(startWidth + delta, 20), 60)
      setSystemPaneWidth(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Render tool calls from current turn
  const renderToolCalls = () => {
    if (!currentView) return null

    const toolCalls = currentView?.toolCalls || []

    if (toolCalls.length === 0) {
      return (
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px 0' }}>
          No tool calls in this turn
        </div>
      )
    }

    return (
      <div className="tool-content">
        {toolCalls.map((tool, index) => {
          const { isCurrentTurn, turnLabel } = getToolTurnInfo(index)
          const isExpanded = expandedTools.has(index) || isCurrentTurn

          return (
            <div
              key={index}
              className={`tool-card ${isExpanded ? 'expanded' : 'collapsed'} ${isCurrentTurn ? '' : 'historical'}`}
            >
              <div className="tool-card-header" onClick={() => toggleTool(index)}>
                <span className="tool-name">
                  {tool.tool}
                  {turnLabel && <span className="tool-turn-badge">{turnLabel}</span>}
                </span>
                <span className="tool-status">{isExpanded ? '▼' : '▶'}</span>
              </div>
              <div className="tool-card-body">
                <div className="tool-args">
                  <div className="tool-section-title">Arguments</div>
                  <pre>{JSON.stringify(tool.args, null, 2)}</pre>
                </div>
                {tool.output && (
                  <div className="tool-output">
                    <div className="tool-section-title">Output</div>
                    <pre>{typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Render messages from current turn
  const renderContent = (content: any): string => {
    if (typeof content === 'string') return content
    if (content && typeof content === 'object') {
      // Handle various message content formats
      if (content.text) return content.text
      if (content.content) return typeof content.content === 'string' ? content.content : JSON.stringify(content.content)
      return JSON.stringify(content)
    }
    return String(content)
  }

  const renderMessages = () => {
    if (!currentView) return null
    const messages = currentView?.messages || []
    const texts = currentView?.turnComplete?.texts || []

    return (
      <div className="chat-content">
        {messages.filter(m => m.role === 'user').map((msg, i) => (
          <div key={i} className="chat-message user">
            <div className="chat-role">User</div>
            {renderContent(msg.content)}
          </div>
        ))}
        {texts.map((text, i) => (
          <div key={i} className="chat-message assistant">
            <div className="chat-role">Assistant</div>
            {renderContent(text)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-title">{currentFile?.filename || 'LLM Log Visualizer'}</span>
        </div>
        <div className="header-right">
          <button className="nav-btn" onClick={handlePrevTurn} disabled={!currentFile || currentTurn <= 1}>
            ←
          </button>
          <span className="turn-indicator">
            {currentFile ? `Turn ${currentTurn} / ${currentFile.turns.length}` : '—'}
          </span>
          <button className="nav-btn" onClick={handleNextTurn} disabled={!currentFile || currentTurn >= (currentFile?.turns.length || 1)}>
            →
          </button>
        </div>
      </header>

      <div
        className="main-container"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <aside className="sidebar">
          <div className="sidebar-header">Files ({loadedFiles.length})</div>
          <div className="file-list">
            {loadedFiles.map((file, index) => (
              <div
                key={file.filename}
                className={`file-item ${index === currentFileIndex ? 'active' : ''}`}
                onClick={() => {
                  setCurrentFileIndex(index)
                  setCurrentTurn(1)
                  setExpandedTools(new Set())
                }}
              >
                <span className="file-icon">📄</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.filename}
                </span>
              </div>
            ))}
            {loadedFiles.length === 0 && (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                Drop files here
              </div>
            )}
          </div>
        </aside>

        <main className="content">
          {currentView ? (
            <div className="content-panes">
              <div className="pane pane-system" style={{ width: `${systemPaneWidth}%` }}>
                <div className="pane-header">
                  <span className="pane-title">System Prompt</span>
                  <span className="pane-badge">
                    {currentView?.systemPrompt?.join('').split(/\s+/).length || 0} words
                  </span>
                </div>
                <div className="pane-content">
                  <div className="system-content">
                    {currentView?.systemPrompt?.join('\n\n')}
                  </div>
                </div>
              </div>

              <div className="resize-handle" onMouseDown={handleResizeStart} ref={resizeRef} />

              <div className="pane pane-chat">
                <div className="pane-header">
                  <span className="pane-title">Conversation</span>
                  <span className="pane-badge">
                    {currentView?.turnComplete?.texts?.join('').split(/\s+/).length || 0} words
                  </span>
                </div>
                <div className="pane-content">
                  {renderMessages()}
                  <div className="tool-section">
                    <div className="pane-title" style={{ marginBottom: '12px' }}>Tool Calls</div>
                    {renderToolCalls()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <div className="empty-text">Drag & drop .jsonl files here</div>
              <div className="empty-hint">or use ← → keys to navigate turns</div>
            </div>
          )}
        </main>
      </div>

      <footer className="status-bar">
        {currentFile && (
          <>
            <div className="status-item">
              <span className="status-label">File:</span>
              <span className="status-value">{currentFile.filename}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Turn:</span>
              <span className="status-value">{currentTurn} / {currentFile.turns.length}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Tools:</span>
              <span className="status-value">{currentView?.toolCalls?.length || 0}</span>
            </div>
          </>
        )}
        {!currentFile && <span style={{ color: 'var(--text-muted)' }}>Ready</span>}
      </footer>

      {isDragging && (
        <div className="drop-zone">
          <div className="drop-zone-inner">
            <div className="drop-zone-icon">📥</div>
            <div className="drop-zone-text">Drop JSONL files</div>
            <div className="drop-zone-hint">Release to load</div>
          </div>
        </div>
      )}
    </div>
  )
}
