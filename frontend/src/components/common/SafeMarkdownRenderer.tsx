// SafeMarkdownRenderer component - 安全的Markdown渲染器
import { type FC } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import styles from '../../styles/markdown.module.css';

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
}

export const SafeMarkdownRenderer: FC<SafeMarkdownRendererProps> = ({
  content,
  className
}) => {
  return (
    <div className={`${styles.markdownContent} ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSanitize, // 防止XSS攻击
          rehypeHighlight
        ]}
        components={{
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            return isInline ? (
              <code className={className} {...props}>
                {children}
              </code>
            ) : (
              <SyntaxHighlighter
                style={github as Record<string, React.CSSProperties>}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            );
          },
          table: ({ children }) => (
            <div style={{ overflowX: 'auto' }}>
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#667eea' }}
            >
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
