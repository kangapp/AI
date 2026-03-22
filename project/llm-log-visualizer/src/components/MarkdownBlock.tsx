import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'

interface MarkdownBlockProps {
  children: string
}

export const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ children }) => {
  return (
    <div className="markdown-block">
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
