import { type FC, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popover } from 'antd';
import { SendOutlined, StopOutlined, BulbOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/chatStore';
import { useSSEContext } from '../../contexts/SSEContext';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { MessageInputContainer } from './MessageInputContainer';
import { PromptTemplatesPopoverContent } from './PromptTemplatesPopoverContent';
import { useHasSelectedAccount } from '../../hooks/useAccountSelection';
import { useI18n } from '../../hooks/useI18n';
import { createChatSession, convertBackendSession } from '../../services/chatApi';
import { logger } from '../../utils/logger';
import '../styles/AIChatInput.css';
import './MessageInput.css';

export const MessageInput: FC = () => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const navigate = useNavigate();
  const { currentChatId, addMessage, createNewChat, messages } = useChatStore();
  const { sendQuery, currentQueryId, cancelGeneration, isCancelling } = useSSEContext();
  const { selectedAccountIds } = useAccountStore(); // AWS 账号
  const { selectedAccountIds: selectedGCPAccountIds } = useGCPAccountStore(); // GCP 账号
  const hasSelectedAccount = useHasSelectedAccount(); // 账号选择状态
  const { t } = useI18n('chat');

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // ✅ 直接从 currentQueryId 派生 loading 状态（单一数据源）
  const loading = !!currentQueryId;

  // 自适应高度处理
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      // 计算内容高度，最大 384px (max-h-96)
      const scrollHeight = textAreaRef.current.scrollHeight;
      const maxHeight = 384;

      if (scrollHeight > maxHeight) {
        textAreaRef.current.style.height = `${maxHeight}px`;
        textAreaRef.current.style.overflowY = 'auto';
      } else {
        textAreaRef.current.style.height = `${scrollHeight}px`;
        textAreaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [message]);

  // ✅ 停止生成处理
  const handleStop = useCallback(() => {
    logger.debug('🔴 [handleStop] 点击了停止按钮');
    logger.debug('🔴 [handleStop] currentQueryId:', currentQueryId);
    if (currentQueryId) {
      cancelGeneration(currentQueryId);
    } else {
      logger.warn('⚠️ [handleStop] currentQueryId 为空，无法取消');
    }
  }, [currentQueryId, cancelGeneration]);

  // 焦点变化处理
  const handleFocusChange = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlurChange = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    logger.debug('🟢 [MessageInput] 点击发送');

    try {
      // 如果没有当前聊天，创建一个新的（临时状态）
      let chatId = currentChatId;
      if (!chatId) {
        chatId = createNewChat();  // ✅ 同步创建临时会话
      }

      // ✅ 检查是否是第一条消息
      const chatMessages = messages[chatId] || [];
      const isFirstMessage = chatMessages.length === 0;

      if (isFirstMessage) {
        try {
          const title = message.trim().slice(0, 20) + (message.trim().length > 20 ? '...' : '');
          const backendSession = await createChatSession(title, chatId);
          const convertedSession = convertBackendSession(backendSession);
          useChatStore.setState(state => ({
            chats: {
              ...state.chats,
              [chatId]: convertedSession
            }
          }));
          useChatStore.getState().saveToStorage();
          navigate(`/c/${chatId}`, { replace: true });
        } catch (error) {
          logger.error(`❌ [MessageInput] 创建后端会话失败: ${error}`);
        }
      }

      // 添加用户消息
      addMessage(chatId, {
        chatId,
        type: 'user',
        content: message.trim(),
        meta: {
          status: 'completed',
          isStreaming: false,
          streamingProgress: 100,
          retryCount: 0,
          maxRetries: 0,
          canRetry: false,
          canEdit: true,
          canDelete: true
        }
      });

      // 清空输入框
      const currentMessage = message.trim();
      setMessage('');
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
      }

      const sessionIdToSend = chatId;
      const queryId = sendQuery(
        currentMessage,
        selectedAccountIds,
        selectedGCPAccountIds,
        sessionIdToSend
      );
      logger.debug('📤 已发送查询，Query ID:', queryId);
    } catch (error) {
      logger.error('发送消息失败:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <MessageInputContainer
      onFocus={handleFocusChange}
      onBlur={handleBlurChange}
      preventScrollJump={true}
      debugMode={process.env.NODE_ENV === 'development'}
      className="message-input-container"
      style={{
        padding: '0 16px 24px 16px', // 给底部留一些空间
        backgroundColor: 'transparent'
      }}
    >
      {/* Claude Style Input */}
      <div className={`ai-chat-input-container ${isFocused ? 'focused' : ''}`}>
        {/* 1. 输入区域 */}
        <div className="ai-chat-input-area">
          <textarea
            ref={textAreaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={handleFocusChange}
            onBlur={handleBlurChange}
            onKeyDown={handleKeyDown}
            placeholder={
              hasSelectedAccount
                ? t('input.placeholder')
                : t('input.placeholderNoAccount')
            }
            className="ai-chat-textarea"
            rows={1}
            disabled={loading && !isCancelling} // 加载中禁用输入，除非正在取消
          />
        </div>

        {/* 2. 工具栏区域 */}
        <div className="ai-chat-input-toolbar">
          {/* 左侧：成本优化助手 */}
          <div className="toolbar-left">
            <Popover
              content={<PromptTemplatesPopoverContent onClose={() => setPopoverOpen(false)} />}
              title="成本优化助手"
              trigger="click"
              open={popoverOpen}
              onOpenChange={setPopoverOpen}
              placement="topLeft"
              overlayStyle={{ width: 350 }}
              align={{ offset: [-14, 0] }}
            >
              <button className="icon-btn" title="成本优化助手">
                <BulbOutlined style={{ fontSize: 18 }} />
              </button>
            </Popover>
          </div>

          {/* 中间模型选择 */}
          <div className="toolbar-center">
            <button className="model-selector-btn">
              <span>Claude 3.5 Sonnet</span>
            </button>
          </div>

          {/* 右侧发送/停止按钮 */}
          <div className="toolbar-right">
            {loading ? (
              <button
                className="send-btn active"
                onClick={handleStop}
                disabled={isCancelling}
                aria-label="Stop generation"
              >
                <div style={{ backgroundColor: '#da7756', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <StopOutlined style={{ color: '#fff', fontSize: '14px' }} />
                </div>
              </button>
            ) : (
              <button
                className={`send-btn ${message.trim() && hasSelectedAccount ? 'active' : ''}`}
                onClick={handleSend}
                disabled={!message.trim() || !hasSelectedAccount}
                aria-label="Send message"
              >
                 <div style={{ backgroundColor: message.trim() && hasSelectedAccount ? '#da7756' : '#f0f0f0', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s' }}>
                    <SendOutlined style={{ color: message.trim() && hasSelectedAccount ? '#fff' : '#a0a0a0' }} />
                 </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </MessageInputContainer>
  );
};
