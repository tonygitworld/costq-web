// SSE Context - 全局SSE连接管理
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  type WebSocketMessage,
  type BatchMessage,
} from '../types/message';
import { type ImageAttachment } from '../types/chat';
import { messageHandler } from '../utils/messageHandler';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../services/apiClient';
import { logger } from '../utils/logger';
import AWSAPIConfirmationDialog from '../components/chat/AWSAPIConfirmationDialog';


interface ConfirmationRequest {
  confirmationId: string;
  toolName: string;
  arguments: Record<string, any>;
  title: string;
  description: string;
  warning: string;
  riskLevel: 'low' | 'medium' | 'high';
  timeoutSeconds: number;
}

interface SSEContextType {
  sendMessage: (message: string | object) => Promise<void>;
  sendQuery: (content: string, accountIds?: string[], gcpAccountIds?: string[], sessionId?: string, modelId?: string, imageAttachments?: ImageAttachment[]) => string;
  cancelGeneration: (queryId: string) => Promise<void>;
  currentQueryId: string | null;
  isCancelling: boolean;
}

const SSEContext = createContext<SSEContextType | null>(null);

export const useSSEContext = () => {
  const context = useContext(SSEContext);
  if (!context) {
    throw new Error('useSSEContext must be used within a SSEProvider');
  }
  return context;
};

// ✅ 可选版本：HMR 期间不抛出错误，返回 null
export const useSSEContextOptional = () => {
  return useContext(SSEContext);
};

interface SSEProviderProps {
  children: React.ReactNode;
}

// ==================== Provider组件 ====================

export const SSEProvider: React.FC<SSEProviderProps> = ({ children }) => {
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // ✅ V2 架构：存储每个查询的 AbortController，用于取消查询
  const queryAbortControllers = useRef<Map<string, AbortController>>(new Map());

  // ⚠️ 已废弃：后端已移除 /api/sse/message 端点
  // 如需发送新查询，请使用 sendQuery
  const sendMessage = async (message: string | object) => {
    logger.warn('⚠️ [SSE] sendMessage 已废弃，后端不再支持此端点:', message);
    /*
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      await apiClient.post('/sse/message', messageStr);
      logger.debug('✅ [SSE] 消息已通过 HTTP POST 发送成功');
    } catch (error) {
      logger.error('❌ [SSE] 发送消息失败:', error);
    }
    */
  };

  const sendQuery = (content: string, accountIds?: string[], gcpAccountIds?: string[], sessionId?: string, modelId?: string, imageAttachments?: ImageAttachment[]): string => {
    messageHandler.resetMessageBuilder();

    const queryId = `query_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const token = useAuthStore.getState().token;

    if (!token) {
      logger.warn('⚠️ [SSEContext.sendQuery] 未登录，无法发送查询');
      return queryId;
    }

    logger.debug(`🟢 [SSEContext.sendQuery] 设置 currentQueryId = ${queryId}, sessionId = ${sessionId}, modelId = ${modelId}`);
    setCurrentQueryId(queryId);

    // ✅ V2: 创建 AbortController 用于取消请求
    const abortController = new AbortController();
    queryAbortControllers.current.set(queryId, abortController);

    // ✅ V2: 使用 apiClient.stream 发起 SSE 流式请求
    // ✅ 统一使用 apiClient，自动处理 Token 刷新和 401 错误
    (async () => {
      try {
        logger.debug(`📤 [SSEContext.sendQuery] 发送查询 - QueryID: ${queryId}, SessionID: ${sessionId}, ModelID: ${modelId}`);

        // ✅ 使用 apiClient.stream，自动处理 Token 刷新和 401 错误
        const requestPayload: Record<string, unknown> = {
          query: content,
          query_id: queryId,
          session_id: sessionId,
          account_ids: accountIds || [],
          gcp_account_ids: gcpAccountIds || [],
          model_id: modelId,  // ✅ 添加 model_id 到请求 payload
        };

        // ✅ 仅在有图片附件时添加 images 字段，确保无图片时请求体不变
        if (imageAttachments && imageAttachments.length > 0) {
          requestPayload.images = imageAttachments.map(a => ({
            file_name: a.fileName,
            mime_type: a.mimeType,
            base64_data: a.base64Data.replace(/^data:[^;]+;base64,/, ''),
          }));
        }

        const response = await apiClient.stream('/sse/query/v2', requestPayload, {
          signal: abortController.signal,  // ✅ 支持取消
        });

        logger.debug(`✅ [SSEContext.sendQuery] SSE查询连接已建立 - QueryID: ${queryId}`);

        // ✅ V2: 处理流式响应
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('无法获取响应流');
        }

        const decoder = new TextDecoder();
        let buffer = '';  // 缓冲区，用于存储不完整的数据

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            logger.debug(`🔌 [SSEContext.sendQuery] 流式响应完成 - QueryID: ${queryId}`);
            // ✅ 流正常结束，清理 AbortController
            // ✅ currentQueryId 的清理由 messageHandler.handleCompletion 统一处理
            queryAbortControllers.current.delete(queryId);
            break;
          }

          // 解码数据块
          buffer += decoder.decode(value, { stream: true });

          // ✅ V2: 解析 SSE 格式: "data: {...}\n\n"
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';  // 保留最后不完整的行

          for (const line of lines) {
            if (line.trim() === '') continue;  // 跳过空行

            if (line.startsWith('data: ')) {
              const data = line.slice(6);  // 去掉 "data: " 前缀

              try {
                const message = JSON.parse(data) as WebSocketMessage;

                // 过滤心跳消息
                if (message.type === 'pong' || message.type === 'ping') {
                  continue;
                }

                // 处理批量消息
                if (message.type === 'batch') {
                  const batchData = message as BatchMessage;
                  if (Array.isArray(batchData.messages)) {
                    batchData.messages.forEach((msg: WebSocketMessage) => {
                      messageHandler.handleMessage(msg);
                    });
                  }
                } else {
                  messageHandler.handleMessage(message);
                }

                // ✅ 如果收到 complete 或 error，让 messageHandler 处理清理（通过 resetCurrentQuery）
                // ✅ 不要在这里立即清理 currentQueryId，让 messageHandler.handleCompletion 统一处理
                if (message.type === 'complete' || message.type === 'error') {
                  logger.debug(`🔌 [SSEContext.sendQuery] 查询完成，关闭连接 - QueryID: ${queryId}`);
                  queryAbortControllers.current.delete(queryId);
                  // ✅ 不在这里清理 currentQueryId，让 messageHandler.handleCompletion 统一处理
                  // ✅ 这样可以确保停止按钮在查询完成前一直显示
                  return;  // 退出循环
                }
              } catch (e) {
                logger.error('❌ [SSEContext.sendQuery] SSE消息解析失败:', e, 'Data:', data);
              }
            } else if (line.startsWith('event: ')) {
              // 处理事件类型（如果需要）
              const eventType = line.slice(7);
              logger.debug(`📋 [SSEContext.sendQuery] 事件类型: ${eventType}`);
            } else if (line.startsWith('id: ')) {
              // 处理事件ID（如果需要）
              const eventId = line.slice(4);
              logger.debug(`🆔 [SSEContext.sendQuery] 事件ID: ${eventId}`);
            }
          }
        }

        // ✅ 流正常结束时的清理（如果还没有收到 complete/error 消息）
        // ✅ 注意：如果收到 complete/error，已经在上面 return 了，不会执行到这里
        // ✅ AbortController 已经在 done 检查中清理了
        // ✅ currentQueryId 的清理由 messageHandler.handleCompletion 统一处理
        // ✅ 如果流正常结束但没有 complete 消息，需要手动清理 currentQueryId
        if (currentQueryId === queryId) {
          logger.debug(`🧹 [SSEContext.sendQuery] 流正常结束但没有 complete 消息，清理 currentQueryId - QueryID: ${queryId}`);
          setCurrentQueryId(null);
        }

      } catch (error: any) {
        queryAbortControllers.current.delete(queryId);
        // ✅ 错误时也不立即清理 currentQueryId，让 messageHandler 统一处理
        // ✅ 如果 error 消息已经通过 handleMessage 处理，会调用 resetCurrentQuery
        // ✅ 但如果错误发生在消息处理之前（如网络错误），需要手动清理
        if (error.name !== 'AbortError' && currentQueryId === queryId) {
          logger.debug(`🧹 [SSEContext.sendQuery] 发生错误，清理 currentQueryId - QueryID: ${queryId}`);
          setCurrentQueryId(null);
        }

        if (error.name === 'AbortError') {
          logger.debug(`🛑 [SSEContext.sendQuery] 查询已取消 - QueryID: ${queryId}`);
        } else {
          logger.error(`❌ [SSEContext.sendQuery] SSE查询连接错误 - QueryID: ${queryId}:`, error);

          // ✅ apiClient 已经处理了 401 错误和 Token 刷新
          // 如果是 401 错误，apiClient 已经处理了通知和跳转
          if (error.message?.includes('401') ||
              error.message?.includes('Unauthorized') ||
              error.message?.includes('过期') ||
              error.message?.includes('expired')) {
            logger.warn('⚠️ [SSEContext.sendQuery] Token 已过期，apiClient 已处理跳转');
          }
        }
      }
    })();

    logger.debug('📤 [SSEContext.sendQuery] 查询已发送，创建Fetch连接:', queryId, content.substring(0, 50), 'session:', sessionId);

    return queryId;
  };

  const resetCurrentQuery = useCallback(() => {
    logger.debug('🔴 [SSEContext] 重置 currentQueryId 和 isCancelling');
    setCurrentQueryId(null);
    setIsCancelling(false);
  }, []);

  const cancellingRef = useRef<Set<string>>(new Set());

  // ✅ V2 架构：取消查询通过 AbortController + 显式调用取消接口实现
  const cancelGeneration = async (queryId: string) => {
    logger.debug('🟡 [SSEContext.cancelGeneration] 开始取消查询:', queryId);

    if (cancellingRef.current.has(queryId)) {
      logger.warn('⚠️ [SSEContext.cancelGeneration] 取消请求已发送，避免重复', queryId);
      return;
    }

    cancellingRef.current.add(queryId);
    setIsCancelling(true);
    logger.debug('🟡 [SSEContext.cancelGeneration] 设置 isCancelling = true');

    try {
      // ✅ 1. 显式调用取消接口（优雅的 API 设计）
      try {
        const { apiClient } = await import('../services/apiClient');
        await apiClient.post(`/sse/cancel/v2/${queryId}`, { reason: 'user_cancelled' });
        logger.debug('✅ [SSEContext.cancelGeneration] 取消接口调用成功 - QueryID:', queryId);
      } catch (error) {
        logger.warn('⚠️ [SSEContext.cancelGeneration] 取消接口调用失败（继续关闭连接）:', error);
        // 即使接口调用失败，也继续关闭连接
      }

      // ✅ 2. 使用 AbortController 关闭连接（双重保障）
      const abortController = queryAbortControllers.current.get(queryId);
      if (abortController) {
        logger.debug('🛑 [SSEContext.cancelGeneration] 关闭连接 - QueryID:', queryId);
        abortController.abort();  // ✅ 这会触发 AbortError，后端会检测到连接断开
        queryAbortControllers.current.delete(queryId);
      } else {
        logger.warn('⚠️ [SSEContext.cancelGeneration] 未找到查询的 AbortController:', queryId);
      }

      // ✅ 3. 清理状态
      setCurrentQueryId(null);
    } catch (error) {
      logger.error('❌ [SSEContext.cancelGeneration] 取消查询失败:', error);
    } finally {
      setTimeout(() => {
        cancellingRef.current.delete(queryId);
        setIsCancelling(false);
      }, 3000);
    }
  };


  const handleApprove = (confirmationId: string) => {
    logger.debug('✅ 用户批准操作:', confirmationId);
    sendMessage({
      type: 'confirmation_response',
      confirmation_id: confirmationId,
      approved: true
    });
    setConfirmationRequest(null);
  };

  const handleReject = (confirmationId: string) => {
    logger.debug('❌ 用户拒绝操作:', confirmationId);
    sendMessage({
      type: 'confirmation_response',
      confirmation_id: confirmationId,
      approved: false
    });
    setConfirmationRequest(null);
  };

  useEffect(() => {
    logger.debug('🔧 [SSEContext] 设置 resetCurrentQuery 回调');
    messageHandler.setResetCurrentQuery(resetCurrentQuery);
  }, [resetCurrentQuery]);

  const contextValue: SSEContextType = {
    sendMessage,
    sendQuery,
    cancelGeneration,
    currentQueryId,
    isCancelling
  };

  return (
    <SSEContext.Provider value={contextValue}>
      {children}

      {confirmationRequest && (
        <AWSAPIConfirmationDialog
          open={true}
          confirmationId={confirmationRequest.confirmationId}
          toolName={confirmationRequest.toolName}
          arguments={confirmationRequest.arguments}
          title={confirmationRequest.title}
          description={confirmationRequest.description}
          warning={confirmationRequest.warning}
          riskLevel={confirmationRequest.riskLevel}
          timeoutSeconds={confirmationRequest.timeoutSeconds}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </SSEContext.Provider>
  );
};
