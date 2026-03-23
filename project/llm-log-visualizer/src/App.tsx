import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { useJsonlParser } from './hooks/useJsonlParser'
import { ContentBlock } from './components/ContentBlock'
import { estimateTokens, formatTokens } from './utils/tokenizer'
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
  const [expandedSystemSections, setExpandedSystemSections] = useState<Set<number>>(new Set([0])) // 默认展开第一个
  const [toolTypeFilter, setToolTypeFilter] = useState<string | null>(null) // tool 类型筛选
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
      // 初始化所有 system sections 为展开状态
      const sectionCount = parsed.cachedViews[0]?.systemPrompt?.length || 0
      setExpandedSystemSections(new Set(Array.from({ length: sectionCount }, (_, i) => i)))
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
  // toolTurnCounts 也是倒序（[turnN, turnN-1, ..., turn1]）
  const getToolTurnInfo = (toolIndex: number): { isCurrentTurn: boolean; turnLabel: string } => {
    const totalTools = currentView?.toolCalls?.length || 0
    const toolTurnCounts = currentView?.toolTurnCounts || []
    if (totalTools === 0 || toolTurnCounts.length === 0) return { isCurrentTurn: false, turnLabel: '' }

    // toolTurnCounts 是倒序：[turnN, turnN-1, ..., turn1]
    // 所以 toolIndices[0] 对应 turnN，toolIndices[last] 对应 turn1
    let accumulated = 0
    for (let i = 0; i < toolTurnCounts.length; i++) {
      const turnToolCount = toolTurnCounts[i]
      const turnNumber = currentTurn - i  // turnN = currentTurn, turnN-1 = currentTurn-1, ...
      const start = accumulated
      const end = accumulated + turnToolCount

      if (toolIndex >= start && toolIndex < end) {
        return {
          isCurrentTurn: turnNumber === currentTurn,
          turnLabel: turnNumber === currentTurn ? '' : `Turn ${turnNumber}`
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

    // 计算 tool 类型统计
    const toolTypeStats = toolCalls.reduce((acc: Record<string, number>, tool) => {
      acc[tool.tool] = (acc[tool.tool] || 0) + 1
      return acc
    }, {})

    // 筛选 tool calls
    const filteredTools = toolTypeFilter
      ? toolCalls.filter(tool => tool.tool === toolTypeFilter)
      : toolCalls

    return (
      <>
        {/* Tool Type Filter Pills */}
        <div className="tool-filter-bar">
          <button
            className={`tool-filter-pill ${toolTypeFilter === null ? 'active' : ''}`}
            onClick={() => setToolTypeFilter(null)}
          >
            All
            <span className="tool-filter-count">{toolCalls.length}</span>
          </button>
          {Object.entries(toolTypeStats).map(([toolName, count]) => (
            <button
              key={toolName}
              className={`tool-filter-pill ${toolTypeFilter === toolName ? 'active' : ''}`}
              onClick={() => setToolTypeFilter(toolTypeFilter === toolName ? null : toolName)}
            >
              {toolName}
              <span className="tool-filter-count">{count}</span>
            </button>
          ))}
        </div>

        {/* Filtered Count */}
        {toolTypeFilter && (
          <div className="tool-filter-info">
            Showing {filteredTools.length} of {toolCalls.length} tools
          </div>
        )}

        {/* Tool Cards */}
        <div className="tool-content">
          {filteredTools.map((tool) => {
            // 找到在原始数组中的索引
            const originalIndex = toolCalls.indexOf(tool)
            const { isCurrentTurn, turnLabel } = getToolTurnInfo(originalIndex)
            const isExpanded = expandedTools.has(originalIndex) || isCurrentTurn

            return (
              <div
                key={originalIndex}
                className={`tool-card ${isExpanded ? 'expanded' : 'collapsed'} ${isCurrentTurn ? '' : 'historical'}`}
              >
                <div className="tool-card-header" onClick={() => toggleTool(originalIndex)}>
                  <span className="tool-name">
                    {tool.tool}
                  </span>
                  <div className="tool-card-actions">
                    {turnLabel && <span className="tool-turn-badge">{turnLabel}</span>}
                    <span className="tool-expand-icon">▼</span>
                  </div>
                </div>
                <div className="tool-card-body">
                  <div className="tool-card-body-inner">
                    <div className="tool-args">
                      <div className="tool-section-subtitle">Arguments</div>
                      <pre>{JSON.stringify(tool.args, null, 2)}</pre>
                    </div>
                    <div className="tool-output">
                      <div className="tool-section-subtitle">Output</div>
                      <ContentBlock
                        content={typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2)}
                        toolName={tool.tool}
                        showLabel={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </>
    )
  }

  // Render messages from current turn
  const renderContent = (content: any): string => {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      // Format: [{ type: "text", text: "...", id: "...", ... }]
      return content.map((c: any) => c.text || '').join('')
    }
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
            <div className="markdown-block">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {renderContent(msg.content)}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {texts.map((text, i) => (
          <div key={i} className="chat-message assistant">
            <div className="chat-role">Assistant</div>
            <div className="markdown-block">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {renderContent(text)}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="header-logo">L</div>
          <span className="header-title">LLM Log</span>
          {currentFile && (
            <span className="header-filename">{currentFile.filename}</span>
          )}
        </div>
        <div className="header-right">
          <div className="turn-nav">
            <button className="nav-btn" onClick={handlePrevTurn} disabled={!currentFile || currentTurn <= 1}>
              ←
            </button>
            <span className="turn-indicator">
              <span className="current">{currentTurn}</span> / {currentFile?.turns.length || '—'}
            </span>
            <button className="nav-btn" onClick={handleNextTurn} disabled={!currentFile || currentTurn >= (currentFile?.turns.length || 1)}>
              →
            </button>
          </div>
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
          <div className="sidebar-header">
            <span className="sidebar-title">Files</span>
            <span className="sidebar-badge">{loadedFiles.length}</span>
          </div>
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
                <span className="file-name">
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
                    {(!currentView?.systemPrompt || currentView.systemPrompt.length === 0) && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No system prompt</div>
                    )}
                    {currentView?.systemPrompt?.map((prompt: string, index: number) => {
                      const isExpanded = expandedSystemSections.has(index)
                      const wordCount = prompt.split(/\s+/).filter(Boolean).length
                      const tokenCount = estimateTokens(prompt)
                      return (
                        <div key={index} className={`system-section ${isExpanded ? 'expanded' : ''}`}>
                          <div
                            className="system-section-header"
                            onClick={() => {
                              setExpandedSystemSections(prev => {
                                const next = new Set(prev)
                                if (next.has(index)) {
                                  next.delete(index)
                                } else {
                                  next.add(index)
                                }
                                return next
                              })
                            }}
                          >
                            <span className="system-section-toggle">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                            <span className="system-section-title">
                              Section {index + 1}
                            </span>
                            <span className="system-section-meta">
                              {wordCount} words | {formatTokens(tokenCount)} tokens
                            </span>
                          </div>
                          {isExpanded && (
                            <div className="system-section-content">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeHighlight]}
                              >
                                {prompt}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      )
                    })}
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
                    <div className="tool-section-header">
                      <span className="tool-section-title">Tool Calls</span>
                      <span className="tool-section-badge">{currentView?.toolCalls?.length || 0}</span>
                    </div>
                    {renderToolCalls()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <div className="empty-text">Drop .jsonl files to analyze</div>
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
            <div className="status-separator" />
            <div className="status-item">
              <span className="status-label">Turn:</span>
              <span className="status-value">{currentTurn} / {currentFile.turns.length}</span>
            </div>
            <div className="status-separator" />
            <div className="status-item">
              <span className="status-label">Tools:</span>
              <span className="status-value">{currentView?.toolCalls?.length || 0}</span>
            </div>
          </>
        )}
        {!currentFile && <span style={{ color: 'var(--text-muted)' }}>Ready</span>}
      </footer>

      <div className={`drop-zone ${isDragging ? 'active' : ''}`}>
        <div className="drop-zone-inner">
          <div className="drop-zone-icon">📥</div>
          <div className="drop-zone-text">Drop JSONL files</div>
          <div className="drop-zone-hint">Release to load</div>
        </div>
      </div>
    </div>
  )
}
