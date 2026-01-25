// StreamingMessage component - 流式消息显示
import { type FC, useReducer, useCallback, useEffect, useRef } from 'react';
import { Button } from 'antd';
import { LoadingOutlined, StopOutlined } from '@ant-design/icons';
import { SafeMarkdownRenderer } from '../common/SafeMarkdownRenderer';

interface StreamingMessageProps {
  content: string;
  isStreaming?: boolean;
  onContentUpdate?: (content: string) => void;
  onStreamingComplete?: () => void;
}

interface StreamingState {
  displayContent: string;
  isAnimating: boolean;
  shouldInterrupt: boolean;
}

type StreamingAction =
  | { type: 'START_STREAMING' }
  | { type: 'UPDATE_CONTENT'; content: string }
  | { type: 'COMPLETE_STREAMING' }
  | { type: 'INTERRUPT_STREAMING' };

const streamingReducer = (state: StreamingState, action: StreamingAction): StreamingState => {
  switch (action.type) {
    case 'START_STREAMING':
      return { ...state, isAnimating: true, shouldInterrupt: false };
    case 'UPDATE_CONTENT':
      return { ...state, displayContent: action.content };
    case 'COMPLETE_STREAMING':
      return { ...state, isAnimating: false };
    case 'INTERRUPT_STREAMING':
      return { ...state, shouldInterrupt: true };
    default:
      return state;
  }
};

export const StreamingMessage: FC<StreamingMessageProps> = ({
  content,
  isStreaming,
  onContentUpdate,
  onStreamingComplete
}) => {
  const animationRef = useRef<number | undefined>(undefined);
  const lastContentRef = useRef('');

  // 使用 useReducer 管理流式状态
  const [state, dispatch] = useReducer(streamingReducer, {
    displayContent: '',
    isAnimating: false,
    shouldInterrupt: false
  });

  // 优化的流式显示逻辑 - 使用 requestAnimationFrame
  const animateContent = useCallback(() => {
    if (state.shouldInterrupt) {
      dispatch({ type: 'COMPLETE_STREAMING' });
      return;
    }

    const currentContent = state.displayContent;
    const targetContent = content;

    if (currentContent.length < targetContent.length) {
      // 逐字符或按chunk追加内容
      const chunkSize = Math.max(1, Math.floor((targetContent.length - currentContent.length) / 10));
      const nextContent = targetContent.slice(0, currentContent.length + chunkSize);

      dispatch({ type: 'UPDATE_CONTENT', content: nextContent });
      onContentUpdate?.(nextContent);

      // 使用 requestIdleCallback 优化性能
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          animationRef.current = requestAnimationFrame(animateContent);
        });
      } else {
        animationRef.current = requestAnimationFrame(animateContent);
      }
    } else {
      dispatch({ type: 'COMPLETE_STREAMING' });
      onStreamingComplete?.();
    }
  }, [content, state.displayContent, state.shouldInterrupt, onContentUpdate, onStreamingComplete]);

  // 处理内容变化
  useEffect(() => {
    if (isStreaming && content !== lastContentRef.current) {
      lastContentRef.current = content;
      if (!state.isAnimating) {
        dispatch({ type: 'START_STREAMING' });
        animateContent();
      }
    } else if (!isStreaming && content !== state.displayContent) {
      // 非流式模式直接显示完整内容
      dispatch({ type: 'UPDATE_CONTENT', content });
    }
  }, [content, isStreaming, animateContent, state.isAnimating, state.displayContent]);

  // 清理动画
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // 中断流式显示的方法
  const interruptStreaming = useCallback(() => {
    dispatch({ type: 'INTERRUPT_STREAMING' });
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  return (
    <div className="streaming-message">
      <div className="markdown-content">
        <SafeMarkdownRenderer content={state.displayContent} />
      </div>

      {isStreaming && (
        <div className="streaming-controls">
          <div className="streaming-indicator">
            <LoadingOutlined /> AI正在思考和生成回答...
          </div>
          <Button
            size="small"
            type="text"
            onClick={interruptStreaming}
            icon={<StopOutlined />}
          >
            停止生成
          </Button>
        </div>
      )}
    </div>
  );
};
