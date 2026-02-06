import { type FC, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popover } from 'antd';
import { SendOutlined, StopOutlined, BulbOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/chatStore';
import { useSSEContext } from '../../contexts/SSEContext';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { MessageInputContainer } from './MessageInputContainer';
import { PromptTemplatesPopoverContent } from './PromptTemplatesPopoverContent';
import { useI18n } from '../../hooks/useI18n';
import { createChatSession, convertBackendSession } from '../../services/chatApi';
import { logger } from '../../utils/logger';
import '../styles/AIChatInput.css';
import { CloudServiceSelector } from './CloudServiceSelector';
import CloudIcon from '../icons/CloudIcon';

export const MessageInput: FC = () => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const navigate = useNavigate();
  const { currentChatId, addMessage, createNewChat, messages } = useChatStore();
  const { sendQuery, currentQueryId, cancelGeneration, isCancelling } = useSSEContext();
  const { accounts: rawAwsAccounts, loading: awsLoading } = useAccountStore(); // AWS 账号列表
  const { accounts: rawGcpAccounts, loading: gcpLoading } = useGCPAccountStore(); // GCP 账号列表
  const { t } = useI18n('chat');

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // 存储账号+服务组合
  const [accountServicePairs, setAccountServicePairs] = useState<Array<{
    accountId: string;        // 前端内部ID
    realAccountId: string;    // 真实的云服务账号ID（AWS: 12位数字）
    accountName: string;
    serviceName: string;
    serviceId: string;
    type: 'aws' | 'gcp';
  }>>([]);

  // 检查是否已选择账号+服务组合
  const hasSelectedAccount = accountServicePairs.length > 0;

  // Map accounts to common format for display
  const awsAccounts = useMemo(() => rawAwsAccounts.map(acc => ({
    id: acc.id,
    name: acc.alias || acc.id,
    icon: <CloudIcon className="text-sm" />,
    accountId: acc.account_id, // Add account_id
    region: acc.region // Add region
  })), [rawAwsAccounts]);

  const gcpAccounts = useMemo(() => rawGcpAccounts.map(acc => ({
    id: acc.id,
    name: acc.account_name || acc.id,
    icon: <CloudIcon className="text-sm" />,
    // GCP 特有字段：使用 project_id 作为 accountId，service_account_email_masked 作为附加信息
    accountId: acc.project_id,           // 使用项目 ID 作为显示标识
    region: acc.service_account_email_masked?.split('@')[0]  // 显示服务账号前缀作为"区域"信息
  })), [rawGcpAccounts]);

  // ✅ 直接从 currentQueryId 派生 loading 状态（单一数据源）
  const loading = !!currentQueryId;

  // 云服务账号加载状态
  const cloudServicesLoading = awsLoading || gcpLoading;

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

  const handleSelectionChange = useCallback((selectedAccountIds: string[]) => {
    // 从selectedAccountIds重建accountServicePairs
    const newPairs: Array<{
      accountId: string;
      realAccountId: string;
      accountName: string;
      serviceName: string;
      serviceId: string;
      type: 'aws' | 'gcp';
    }> = [];

    selectedAccountIds.forEach(accountId => {
      const awsAccount = rawAwsAccounts.find(acc => acc.id === accountId);
      const gcpAccount = rawGcpAccounts.find(acc => acc.id === accountId);

      if (awsAccount) {
        newPairs.push({
          accountId,
          realAccountId: awsAccount.account_id || awsAccount.id,
          accountName: awsAccount.alias || awsAccount.id,
          serviceName: 'AWS',
          serviceId: 'aws',
          type: 'aws'
        });
      } else if (gcpAccount) {
        newPairs.push({
          accountId,
          realAccountId: gcpAccount.id,
          accountName: gcpAccount.account_name || gcpAccount.id,
          serviceName: 'GCP',
          serviceId: 'gcp',
          type: 'gcp'
        });
      }
    });

    setAccountServicePairs(newPairs);
  }, [rawAwsAccounts, rawGcpAccounts]);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    // ✅ 检查是否已选择账号+服务组合
    if (accountServicePairs.length === 0) {
      logger.warn('⚠️ [MessageInput] 未选择任何云服务账号，无法发送消息');
      // 可以在这里显示提示信息
      return;
    }

    logger.debug('🟢 [MessageInput] 点击发送');
    logger.debug('📊 [MessageInput] 当前选择的账号+服务组合:', accountServicePairs);

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

      // 🔧 修复：延迟添加 AI 占位消息，确保 useLayoutEffect 先检测到用户消息并滚动
      // 使用 setTimeout(0) 将 AI 消息添加推迟到下一个事件循环
      setTimeout(() => {
        // ✅ 立即添加 AI 占位消息，确保 UI 显示 Loading 状态
        addMessage(chatId, {
          chatId,
          type: 'assistant',
          content: '', // 初始内容为空
          statusMessage: '正在分析您的请求...', // 触发 StatusCard 显示
          statusEstimatedSeconds: 5, // 初始预估时间
          meta: {
            status: 'pending', // 标记为等待中
            isStreaming: true, // 标记为流式传输
            streamingProgress: 0,
            retryCount: 0,
            maxRetries: 0,
            canRetry: false,
            canEdit: false,
            canDelete: false
          }
        });
      }, 0);

      // 清空输入框
      const currentMessage = message.trim();
      setMessage('');
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
      }

      const sessionIdToSend = chatId;

      // 从 accountServicePairs 中提取 AWS 和 GCP 账号 ID（使用数据库记录 ID）
      const awsAccountIds = accountServicePairs
        .filter(pair => pair.type === 'aws')
        .map(pair => pair.accountId);  // 使用数据库 UUID
      const gcpAccountIds = accountServicePairs
        .filter(pair => pair.type === 'gcp')
        .map(pair => pair.accountId);  // 使用数据库 UUID

      logger.debug('📤 [MessageInput] 准备发送查询:', {
        message: currentMessage,
        awsAccountIds,
        gcpAccountIds,
        sessionId: sessionIdToSend,
        note: '发送数据库记录 ID（UUID），后端会查找对应的 AWS 账号 ID'
      });

      const queryId = sendQuery(
        currentMessage,
        awsAccountIds,
        gcpAccountIds,
        sessionIdToSend
      );
      logger.debug('📤 [MessageInput] 已发送查询，Query ID:', queryId);
    } catch (error) {
      logger.error('❌ [MessageInput] 发送消息失败:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ✅ 渲染标准聊天输入框
  const renderContent = () => {

    // 场景 3: 标准对话模式 - 显示底部固定输入框
    return (
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
                : "⚠️ 请先在右下角选择云账号以开始成本分析"
            }
            className={`ai-chat-textarea ${!hasSelectedAccount ? 'warning-placeholder' : ''}`}
            rows={1}
            disabled={(loading && !isCancelling) || !hasSelectedAccount} // 加载中或未选择账号时禁用输入
          />
        </div>

        {/* 2. 工具栏区域 */}
        <div className="ai-chat-input-toolbar">
          {/* 左侧：成本优化助手 */}
          <div className="toolbar-left">
            <Popover
              content={<PromptTemplatesPopoverContent onClose={() => setPopoverOpen(false)} />}
              title={
                <span>
                  成本优化助手
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 'normal', color: '#999' }}>
                    选择模板快速分析 AWS/GCP 成本
                  </span>
                </span>
              }
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

          {/* 右侧：云服务选择 + 发送按钮 */}
          <div className="toolbar-right" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {/* 云服务选择器 - 新的Drawer组件 */}
            <CloudServiceSelector
              awsAccounts={awsAccounts}
              gcpAccounts={gcpAccounts}
              onSelectionChange={handleSelectionChange}
              initialSelectedAccountIds={accountServicePairs.map(p => p.accountId)}
              loading={cloudServicesLoading}
            />

            {/* 发送/停止按钮 */}
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
    );
  };

  return (
    <>
      <MessageInputContainer
        onFocus={handleFocusChange}
        onBlur={handleBlurChange}
        preventScrollJump={true}
        debugMode={process.env.NODE_ENV === 'development'}
        className="message-input-container"
        style={{
          padding: '0 16px 8px 16px',
          backgroundColor: 'transparent'
        }}
      >
        {renderContent()}
      </MessageInputContainer>

      {/* AI 生成内容提示 - 移到输入框外部 */}
      <div className="ai-disclaimer" style={{
        marginTop: '8px',
        fontSize: '12px',
        textAlign: 'center',
        width: '100%',
        pointerEvents: 'none',
        userSelect: 'none',
        color: 'rgba(0, 0, 0, 0.45)',
        padding: '0 16px'
      }}>
        AI 生成内容仅供参考，请核实关键成本信息。
      </div>
    </>
  );
};
