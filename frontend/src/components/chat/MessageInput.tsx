// MessageInput component - Message input area
import { type FC, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Typography, Tooltip } from 'antd';
import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/chatStore';
import { useSSEContext } from '../../contexts/SSEContext';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { MessageInputContainer } from './MessageInputContainer';
import { PromptTemplatesSection } from './PromptTemplatesSection';
import { useHasSelectedAccount } from '../../hooks/useAccountSelection';
import { useI18n } from '../../hooks/useI18n';
import { createChatSession, convertBackendSession } from '../../services/chatApi';
import { logger } from '../../utils/logger';
import './MessageInput.css';

const { Text } = Typography;

const { TextArea } = Input;

export const MessageInput: FC = () => {
  const [message, setMessage] = useState('');
  const [, setIsFocused] = useState(false);
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

  // ✅ 停止生成处理
  const handleStop = useCallback(() => {
    logger.debug('🔴 [handleStop] 点击了停止按钮');
    logger.debug('🔴 [handleStop] currentQueryId:', currentQueryId);
    logger.debug('🔴 [handleStop] cancelGeneration:', typeof cancelGeneration);
    if (currentQueryId) {
      logger.debug('🛑 [handleStop] 调用 cancelGeneration - Query:', currentQueryId);
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

      // ✅ 检查是否是第一条消息（需要创建后端会话）
      const chatMessages = messages[chatId] || [];
      const isFirstMessage = chatMessages.length === 0;

      if (isFirstMessage) {
        // ✅ 发送第一条消息时，创建后端会话
        try {
          logger.debug(`📤 [MessageInput] 第一条消息，创建后端会话: ${chatId}`);
          const title = message.trim().slice(0, 20) + (message.trim().length > 20 ? '...' : '');
          const backendSession = await createChatSession(title, chatId);
          logger.debug(`✅ [MessageInput] 后端会话创建成功: ${chatId}`);

          // ✅ 更新前端会话信息（使用后端返回的数据）
          const convertedSession = convertBackendSession(backendSession);
          useChatStore.setState(state => ({
            chats: {
              ...state.chats,
              [chatId]: convertedSession
            }
          }));

          // ✅ 保存到 localStorage（现在有消息了，应该显示在历史列表）
          useChatStore.getState().saveToStorage();

          // ✅ 更新 URL 到会话页面（第一条消息发送后）
          navigate(`/c/${chatId}`, { replace: true });
        } catch (error) {
          logger.error(`❌ [MessageInput] 创建后端会话失败: ${error}`);
          // ✅ 即使后端创建失败，也继续发送消息（后端会在发送时创建）
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

      // ✅ 新架构：每个查询都会创建新的 SSE 连接，无需检查连接状态

      // ✅ 现在 chatId 总是真实UUID（前端生成），直接传递
      // ✅ 后端会验证UUID是否存在，如果不存在则使用此UUID创建新会话
      const sessionIdToSend = chatId;  // 总是传递真实UUID

      logger.debug('📤 准备发送查询:', {
        chatId,
        sessionIdToSend: sessionIdToSend,  // 总是真实UUID
        isFirstMessage,
      });

      // ✅ sendQuery 会设置 currentQueryId，自动触发 loading = true
      // 每个查询都会创建新的 SSE 连接，无需检查连接状态
      const queryId = sendQuery(
        currentMessage,
        selectedAccountIds,  // AWS 账号列表
        selectedGCPAccountIds,  // GCP 账号列表
        sessionIdToSend  // ✅ 传递前端生成的UUID
      );
      logger.debug('📤 已发送查询，Query ID:', queryId, 'Session ID:', sessionIdToSend);
      logger.debug('🟢 [MessageInput] currentQueryId 已设置，loading 自动变为 true');
    } catch (error) {
      logger.error('发送消息失败:', error);
    }
  };



  const handleKeyPress = (e: React.KeyboardEvent) => {
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
    >
      {/* 新增：Prompt Templates Section */}
      <PromptTemplatesSection />

      <div style={{
        padding: '16px 24px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e8e8e8',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.04)'
      }}>
        <TextArea
          ref={textAreaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            hasSelectedAccount
              ? t('input.placeholder')
              : t('input.placeholderNoAccount')
          }
          autoSize={{ minRows: 2, maxRows: 6 }}
          className={`message-input-textarea ${
            hasSelectedAccount ? 'message-input-textarea-enabled' : 'message-input-textarea-disabled'
          }`}
          disabled={loading || !hasSelectedAccount}
        />

        <div className="message-input-actions">
          {/* 左侧：空白占位 */}
          <div className="message-input-actions-left" />

          {/* 右侧：字数统计 + 发送按钮 */}
          <div className="message-input-actions-right">
            <Text type="secondary" className="message-input-char-count">
              {t('input.characterCount', { count: message.length })}
            </Text>

            {/* ✅ 停止按钮（生成中时显示） */}
            {loading ? (
              <Tooltip title={t('input.stopButton')}>
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={handleStop}
                  loading={isCancelling}
                  className="message-input-button"
                >
                  {isCancelling ? t('input.stopping') : t('input.stopButton')}
                </Button>
              </Tooltip>
            ) : (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                disabled={!message.trim() || !hasSelectedAccount}
                className="message-input-button"
              >
                {t('input.sendButton')}
              </Button>
            )}

            {/* 🐛 调试信息 - 生产环境请删除 */}
            {process.env.NODE_ENV === 'development' && (
              <span className="message-input-debug">
                v2.1 loading={loading ? '✅' : '❌'}
              </span>
            )}
          </div>
        </div>
      </div>
    </MessageInputContainer>
  );
};
