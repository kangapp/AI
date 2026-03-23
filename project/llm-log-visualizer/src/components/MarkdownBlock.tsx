import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

interface MarkdownBlockProps {
  children: string
}

export const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ children }) => {
  return (
    <div className="markdown-block">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
