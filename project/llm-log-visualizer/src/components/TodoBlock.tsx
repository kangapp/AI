import React from 'react'

interface TodoBlockProps {
  children: string
}

export const TodoBlock: React.FC<TodoBlockProps> = ({ children }) => {
  const lines = children.split('\n').filter(line => line.trim())

  return (
    <div className="todo-block">
      {lines.map((line, i) => {
        const isChecked = line.includes('- [x]') || line.includes('- [X]')
        const isUnchecked = line.includes('- [ ]')
        const text = line.replace(/- \[[xX ]\]\s*/, '')

        return (
          <div key={i} className={`todo-item ${isChecked ? 'checked' : ''}`}>
            <span className="todo-checkbox">
              {isChecked ? '☑' : isUnchecked ? '☐' : '•'}
            </span>
            <span className="todo-text">{text}</span>
          </div>
        )
      })}
    </div>
  )
}
