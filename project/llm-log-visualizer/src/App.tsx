import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'
import { useJsonlParser } from './hooks/useJsonlParser'
import { ContentBlock } from './components/ContentBlock'
import { SystemPrompt } from './components/SystemPrompt'
import type {
  JsonlFile,
  ReasoningEvent,
  AgentSwitchEvent,
  RetryEvent,
  FileReferenceEvent,
  SubtaskStartEvent,
  PermissionRequestEvent,
} from './types'

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#6b8fd4',
    primaryTextColor: '#fff',
    primaryBorderColor: '#444',
    lineColor: '#888',
    secondaryColor: '#3d3425',
    tertiaryColor: '#292524',
  }
})

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
  const [toolTypeFilter, setToolTypeFilter] = useState<string | null>(null) // tool 类型筛选
  const [chatPaneHeight, setChatPaneHeight] = useState(60) // percentage
  const [selectedTool, setSelectedTool] = useState<{ tool: any; index: number } | null>(null) // 选中的 tool 用于详情弹窗
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

  // Render mermaid diagrams after content updates
  useEffect(() => {
    const renderMermaid = async () => {
      const mermaidElements = document.querySelectorAll('.mermaid')
      if (mermaidElements.length > 0) {
        try {
          await mermaid.run({
            querySelector: '.mermaid'
          })
        } catch (e) {
          console.warn('Mermaid render error:', e)
        }
      }
    }
    renderMermaid()
  }, [currentView])

  // 计算指定 turn 的工具索引集合
  const getToolIndicesForTurn = (turn: number, toolTurnCounts: number[]): Set<number> => {
    const indices = new Set<number>()
    let accumulated = 0
    for (let i = 0; i < toolTurnCounts.length; i++) {
      const turnNumber = turn - i
      if (turnNumber === turn) {
        for (let j = 0; j < toolTurnCounts[i]; j++) {
          indices.add(accumulated + j)
        }
      }
      accumulated += toolTurnCounts[i]
    }
    return indices
  }

  const handlePrevTurn = () => {
    if (currentTurn > 1) {
      const newTurn = currentTurn - 1
      const newView = currentFile?.cachedViews[newTurn - 1]
      const toolTurnCounts = newView?.toolTurnCounts || []
      setCurrentTurn(newTurn)
      setExpandedTools(getToolIndicesForTurn(newTurn, toolTurnCounts))
    }
  }

  const handleNextTurn = () => {
    if (currentFile && currentTurn < currentFile.turns.length) {
      const newTurn = currentTurn + 1
      const newView = currentFile?.cachedViews[newTurn - 1]
      const toolTurnCounts = newView?.toolTurnCounts || []
      setCurrentTurn(newTurn)
      setExpandedTools(getToolIndicesForTurn(newTurn, toolTurnCounts))
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

  // Chat pane vertical resize
  const handleChatResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = chatPaneHeight
    const container = document.querySelector('.conversation-area') as HTMLElement
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      const containerRect = container.getBoundingClientRect()
      const containerHeight = containerRect.height
      const delta = ((e.clientY - startY) / containerHeight) * 100
      const newHeight = Math.min(Math.max(startHeight + delta, 40), 70)
      setChatPaneHeight(newHeight)
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
      <div className="tool-content">
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
        <div className="tool-cards">
          {filteredTools.map((tool) => {
            // 找到在原始数组中的索引
            const originalIndex = toolCalls.indexOf(tool)
            const { isCurrentTurn, turnLabel } = getToolTurnInfo(originalIndex)
            const isExpanded = expandedTools.has(originalIndex)

            return (
              <div
                key={originalIndex}
                className={`tool-card ${isExpanded ? 'expanded' : 'collapsed'} ${isCurrentTurn ? '' : 'historical'}`}
              >
                <div className="tool-card-header">
                  <div className="tool-card-main" onClick={() => setSelectedTool({ tool, index: originalIndex })}>
                    <span className="tool-name">
                      {tool.tool}
                    </span>
                    <div className="tool-card-actions">
                      {turnLabel && <span className="tool-turn-badge">{turnLabel}</span>}
                    </div>
                  </div>
                  <button
                    className="tool-expand-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleTool(originalIndex)
                    }}
                  >
                    {isExpanded ? '−' : '+'}
                  </button>
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
      </div>
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

  // Render reasoning event
  const renderReasoning = (event: ReasoningEvent, index: number) => (
    <div key={`reasoning-${index}`} className="chat-message reasoning">
      <div className="chat-role">🔄 Thinking</div>
      <div className="reasoning-content">
        {event.content}
      </div>
    </div>
  )

  // Render agent switch event
  const renderAgentSwitch = (event: AgentSwitchEvent, index: number) => (
    <div key={`agent-switch-${index}`} className="chat-message system">
      <div className="chat-role">🔀 Agent Switch</div>
      <div className="system-event-content">
        Switched to: <strong>{event.agent}</strong>
      </div>
    </div>
  )

  // Render retry event
  const renderRetry = (event: RetryEvent, index: number) => (
    <div key={`retry-${index}`} className="chat-message warning">
      <div className="chat-role">⚠️ Retry</div>
      <div className="retry-content">
        Attempt {event.attempt}: {event.error}
      </div>
    </div>
  )

  // Render file reference event
  const renderFileReference = (event: FileReferenceEvent, index: number) => (
    <div key={`file-ref-${index}`} className="chat-message attachment">
      <div className="chat-role">📎 File Reference</div>
      <div className="file-ref-content">
        <span className="file-ref-name">{event.filename}</span>
        <span className="file-ref-mime">{event.mime}</span>
      </div>
    </div>
  )

  // Render subtask start event
  const renderSubtaskStart = (event: SubtaskStartEvent, index: number) => (
    <div key={`subtask-${index}`} className="chat-message system">
      <div className="chat-role">📋 Subtask Started</div>
      <div className="subtask-content">
        {event.description || (event.prompt ? event.prompt.substring(0, 100) : '')}
      </div>
    </div>
  )

  // Render permission request event
  const renderPermissionRequest = (event: PermissionRequestEvent, index: number) => (
    <div key={`permission-${index}`} className="chat-message permission">
      <div className="chat-role">🔒 Permission</div>
      <div className="permission-content">
        {event.title || event.permissionType}: {event.status}
      </div>
    </div>
  )

  const renderContentPanes = () => {
    if (!currentView) return null
    return (
      <div className="content-panes">
        <div className="pane pane-system" style={{ width: `${systemPaneWidth}%` }}>
          <SystemPrompt turn={currentFile?.turns[currentTurn - 1]} />
        </div>

        <div className="resize-handle" onMouseDown={handleResizeStart} ref={resizeRef} />

        <div className="pane pane-chat">
          <div className="pane-header">
            <span className="pane-title">Conversation</span>
            <span className="pane-badge">
              {currentView?.chatItems.filter(i => i.kind === 'assistant').length || 0} msgs
            </span>
          </div>
          <div
            className="conversation-area"
            style={{
              '--chat-flex': `${chatPaneHeight}`,
              '--tool-flex': `${100 - chatPaneHeight}`,
            } as React.CSSProperties}
          >
            <div className="chat-history-pane">
              <div className="pane-content">
                {renderMessages()}
              </div>
            </div>
            <div className="chat-resize-handle" onMouseDown={handleChatResizeStart} />
            <div className="tool-calls-pane">
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
      </div>
    )
  }

  const renderEmptyState = () => (
    <div className="empty-state">
      <div className="empty-icon">📂</div>
      <div className="empty-text">Drop .jsonl files to analyze</div>
      <div className="empty-hint">or use ← → keys to navigate turns</div>
    </div>
  )

  const renderMessages = () => {
    if (!currentView) return null
    const chatItems = currentView?.chatItems || []

    return (
      <div className="chat-content">
        {chatItems.map((item, i) => {
          switch (item.kind) {
            case 'user':
              return (
                <div key={`user-${i}`} className={`chat-message user ${item.contentType === 'file' ? 'user-file' : item.contentType === 'command' ? 'user-command' : ''}`}>
                  <div className="chat-role">
                    {item.contentType === 'file' ? (
                      <span className="file-tag">
                        <span className="file-tag-label">📎 FILE</span>
                        {item.mime && <span className="file-tag-mime">{item.mime}</span>}
                      </span>
                    ) : item.contentType === 'command' ? (
                      '⌨️ Command'
                    ) : (
                      'User'
                    )}
                  </div>
                  {item.contentType === 'file' && item.hasContent && (
                    <div className="file-content-wrapper">
                      <div className="markdown-block">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            code: ({ node, className, children, ...props }) => {
                              const match = /language-(\w+)/.exec(className || '')
                              const codeString = String(children).replace(/\n$/, '')

                              // Render mermaid diagrams
                              if (match && match[1] === 'mermaid') {
                                return (
                                  <div className="mermaid-chart">
                                    <div className="mermaid" dangerouslySetInnerHTML={{ __html: codeString }} />
                                  </div>
                                )
                              }

                              // Regular code block
                              if (className) {
                                return (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                )
                              }

                              return <code {...props}>{children}</code>
                            }
                          }}
                        >
                          {renderContent(item.content)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  {(!item.hasContent || item.contentType !== 'file') && (
                    <div className="markdown-block">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          code: ({ node, className, children, ...props }) => {
                            const match = /language-(\w+)/.exec(className || '')
                            const codeString = String(children).replace(/\n$/, '')

                            // Render mermaid diagrams
                            if (match && match[1] === 'mermaid') {
                              return (
                                <div className="mermaid-chart">
                                  <div className="mermaid" dangerouslySetInnerHTML={{ __html: codeString }} />
                                </div>
                              )
                            }

                            // Regular code block
                            if (className) {
                              return (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              )
                            }

                            return <code {...props}>{children}</code>
                          }
                        }}
                      >
                        {renderContent(item.content)}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )
            case 'assistant':
              return (
                <div key={`assistant-${i}`} className="chat-message assistant">
                  <div className="chat-role">Assistant</div>
                  <div className="markdown-block">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {renderContent(item.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            case 'reasoning':
              return renderReasoning({ type: 'reasoning', turn: item.turn, content: item.content } as ReasoningEvent, i)
            case 'agent_switch':
              return renderAgentSwitch({ type: 'agent_switch', turn: item.turn, agent: item.agent, source: '' } as AgentSwitchEvent, i)
            case 'retry':
              return renderRetry({ type: 'retry', turn: item.turn, attempt: item.attempt, error: item.error } as RetryEvent, i)
            case 'file_reference':
              return renderFileReference({ type: 'file_reference', turn: item.turn, filename: item.filename, mime: item.mime, url: item.url } as FileReferenceEvent, i)
            case 'subtask_start':
              return renderSubtaskStart({ type: 'subtask_start', turn: item.turn, description: item.description, prompt: '', sessionID: '', shortUUID: '', parentShortUUID: '', agent: '', model: { providerID: '', modelID: '' }, command: '' } as SubtaskStartEvent, i)
            case 'permission_request':
              return renderPermissionRequest({ type: 'permission_request', turn: item.turn, permissionType: item.permissionType, title: item.title, status: item.status, pattern: '' } as PermissionRequestEvent, i)
            default:
              return null
          }
        })}
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
          {currentView ? renderContentPanes() : renderEmptyState()}
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

      {/* Tool Detail Modal */}
      {selectedTool && (
        <div className="tool-modal-overlay" onClick={() => setSelectedTool(null)}>
          <div className="tool-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tool-modal-header">
              <div className="tool-modal-title">
                <span className="tool-name">{selectedTool.tool.tool}</span>
                {getToolTurnInfo(selectedTool.index).turnLabel && (
                  <span className="tool-turn-badge">{getToolTurnInfo(selectedTool.index).turnLabel}</span>
                )}
              </div>
              <button className="tool-modal-close" onClick={() => setSelectedTool(null)}>×</button>
            </div>
            <div className="tool-modal-body">
              <div className="tool-modal-section">
                <div className="tool-section-subtitle">Arguments</div>
                <pre className="tool-modal-pre">{JSON.stringify(selectedTool.tool.args, null, 2)}</pre>
              </div>
              <div className="tool-modal-section">
                <div className="tool-section-subtitle">Output</div>
                <ContentBlock
                  content={typeof selectedTool.tool.output === 'string' ? selectedTool.tool.output : JSON.stringify(selectedTool.tool.output, null, 2)}
                  toolName={selectedTool.tool.tool}
                  showLabel={true}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
