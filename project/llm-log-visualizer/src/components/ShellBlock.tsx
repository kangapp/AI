import React from 'react'

interface ShellBlockProps {
  children: string
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
              <span className="shell-command">{line.slice(2)}</span>
            </>
          ) : (
            <span className="shell-output">{line}</span>
          )}
        </div>
      ))}
    </div>
  )
}
