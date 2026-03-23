import React from 'react'

interface CodeBlockProps {
  children: string
}

// Escape HTML to display tags as text
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ children }) => {
  const lines = children.split('\n')

  return (
    <div className="code-block">
      {lines.map((line, i) => (
        <div key={i} className="code-line">
          <span className="code-line-number">{i + 1}</span>
          <span className="code-content" dangerouslySetInnerHTML={{ __html: escapeHtml(line) }} />
        </div>
      ))}
    </div>
  )
}