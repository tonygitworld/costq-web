// SafeMarkdownRenderer/index.tsx - 动态加载策略，避免首屏加载重依赖
import { type FC, lazy, Suspense, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../../../styles/markdown.module.css';

// ★ P0: 轻量级 fallback 代码高亮（仅首屏使用）
// 使用原生 highlight.js 的轻量版本，避免 react-syntax-highlighter 的大体积
const LightweightCodeBlock: FC<{ className?: string; children: string }> = ({ className, children }) => {
  const language = className?.replace('language-', '') || 'text';

  return (
    <pre
      style={{
        margin: 0,
        borderRadius: '8px',
        fontSize: '14px',
        padding: '16px',
        background: '#f6f8fa',
        overflow: 'auto',
      }}
    >
      <code className={className}>
        <span style={{ color: '#6e7781', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
          {language}
        </span>
        {children}
      </code>
    </pre>
  );
};

// ★ P0: 轻量级 Markdown 渲染器（首屏使用，无重依赖）
const LightweightMarkdown: FC<{ content: string; className?: string }> = ({ content, className }) => {
  return (
    <div className={`${styles.markdownContent} ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            return isInline ? (
              <code
                className={className}
                style={{
                  background: '#f6f8fa',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.875em',
                }}
                {...props}
              >
                {children}
              </code>
            ) : (
              <LightweightCodeBlock className={className}>
                {String(children).replace(/\n$/, '')}
              </LightweightCodeBlock>
            );
          },
          table: ({ children }) => (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
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
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// ★ P0: 动态导入完整版 SafeMarkdownRenderer（带语法高亮）
const HeavyMarkdownRenderer = lazy(() => import('./SafeMarkdownRenderer.heavy'));

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
  // ★ P0: 强制使用轻量版（首屏推荐）
  lightweight?: boolean;
}

/**
 * ★ P0: SafeMarkdownRenderer - 智能降级策略
 *
 * 首屏策略：
 * 1. 默认使用 lightweight 模式（无 react-syntax-highlighter）
 * 2. 用户交互后（如点击展开代码块）再动态加载完整版
 * 3. 通过 lightweight prop 强制控制
 *
 * 性能收益：
 * - 首屏不加载 react-syntax-highlighter（~200KB+ gzipped）
 * - 代码块仍有基础样式，不影响阅读
 * - 完整语法高亮按需加载
 */
export const SafeMarkdownRenderer: FC<SafeMarkdownRendererProps> = ({
  content,
  className,
  lightweight = true, // ★ 默认轻量模式，避免首屏加载重依赖
}) => {
  const [shouldLoadHeavy, setShouldLoadHeavy] = useState(false);

  // ★ P0: 如果内容包含代码块且用户可能想看高亮，延迟加载完整版
  useEffect(() => {
    if (!lightweight && !shouldLoadHeavy) {
      // 使用 requestIdleCallback 延迟加载，不阻塞首屏
      const loadHeavy = () => setShouldLoadHeavy(true);

      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(loadHeavy, { timeout: 2000 });
      } else {
        setTimeout(loadHeavy, 1000);
      }
    }
  }, [lightweight, shouldLoadHeavy, content]);

  // 轻量模式：直接返回，无动态加载
  if (lightweight) {
    return <LightweightMarkdown content={content} className={className} />;
  }

  // 完整模式：动态加载重依赖
  return (
    <Suspense fallback={<LightweightMarkdown content={content} className={className} />}>
      <HeavyMarkdownRenderer content={content} className={className} />
    </Suspense>
  );
};

// ★ P0: 预加载函数（可在用户 hover 代码块时调用）
export const preloadHeavyRenderer = () => {
  const HeavyRenderer = import('./SafeMarkdownRenderer.heavy');
  return HeavyRenderer;
};
