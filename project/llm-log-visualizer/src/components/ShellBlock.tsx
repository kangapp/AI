import React from 'react'

interface ShellBlockProps {
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

export const ShellBlock: React.FC<ShellBlockProps> = ({ children }) => {
  const lines = children.split('\n')

  return (
    <div className="shell-block">
      {lines.map((line, i) => (
        <div key={i} className="shell-line">
          {line.startsWith('$ ') ? (
            <>
              <span className="shell-prompt">$</span>
              <span className="shell-command" dangerouslySetInnerHTML={{ __html: escapeHtml(line.slice(2)) }} />
            </>
          ) : (
            <span className="shell-output" dangerouslySetInnerHTML={{ __html: escapeHtml(line) }} />
          )}
        </div>
      ))}
    </div>
  )
}
