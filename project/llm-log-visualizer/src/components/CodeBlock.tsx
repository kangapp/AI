import React from 'react'

interface CodeBlockProps {
  children: string
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ children }) => {
  const lines = children.split('\n')

  return (
    <div className="code-block">
      {lines.map((line, i) => (
        <div key={i} className="code-line">
          <span className="code-line-number">{i + 1}</span>
          <span className="code-content">{line}</span>
        </div>
      ))}
    </div>
  )
}