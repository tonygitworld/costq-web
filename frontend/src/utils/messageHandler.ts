// Message handling system (used by both SSE and WebSocket)
import { type WebSocketMessage, type StreamChunkMessage, type CompletionMessage, type TokenUsageMessage } from '../types/message';
import { type ThinkingData, type ToolCallData, type ContentBlock, type Message, type TokenUsage } from '../types/chat';
import { useChatStore } from '../stores/chatStore';
import { notification } from 'antd';
import { logger } from './logger';
import i18n from '../i18n';

// 消息构建器状态类型
interface MessageBuilderState {
  thinking?: ThinkingData;
  toolCalls?: Map<string, ToolCallData>;
  content: string;
  messageId?: string;
  chatId?: string;
  contentBlocks?: ContentBlock[];
}

// 消息更新类型
type MessageUpdate = Partial<Message> & {
  meta?: Partial<Message['meta']>;
};

export class MessageHandler {
  // ❌ 删除静态缓存：private chatStore = useChatStore.getState();
  // ✅ 改为每次都获取最新的 store state
  private resetCurrentQuery: (() => void) | null = null;  // ✅ 新增：重置查询的回调

  // ✅ 新增：已处理事件ID集合（防止重复）
  private processedEventIds = new Set<string>();

  // ✅ 新增：缓存待处理的 Token 统计（解决竞态条件）
  private pendingTokenUsage: Map<string, TokenUsage> = new Map();

  // ✅ 新增：已取消标志（丢弃 abort 后到达的残留消息）
  private isCancelled = false;

  // ✅ 新增：当前查询 ID（用于过滤非当前查询的事件）
  private currentQueryId: string | null = null;

  // ✨ 新增：当前消息的构建状态
  private currentMessageBuilder: MessageBuilderState = {
    thinking: undefined,
    toolCalls: new Map(),
    content: '',
    messageId: undefined,  // ✅ 显式初始化为 undefined
    contentBlocks: [],
    chatId: undefined
  };

  // ✅ 移除 requestAnimationFrame 批处理机制，实现真正的流式输出
  // 原因：RAF 批处理会合并多个 content_delta 事件，导致用户看不到流畅的逐字显示效果

  // ✅ 新增：获取最新 store 的 getter
  private get chatStore() {
    return useChatStore.getState();
  }

  constructor() {
    // ❌ 删除 subscribe 订阅（不需要了）
  }

  // ✅ 新增：设置重置查询的回调
  setResetCurrentQuery(callback: () => void) {
    this.resetCurrentQuery = callback;
  }

  // ✅ 新增：设置当前查询 ID
  setCurrentQueryId(queryId: string | null) {
    this.currentQueryId = queryId;
  }

  // ✅ 新增：重置消息构建器（在发送新查询时调用）
  resetMessageBuilder() {
    logger.debug(`🔄 [messageHandler] 重置消息构建器，准备新查询 - 旧 messageId: ${this.currentMessageBuilder.messageId}, 旧 chatId: ${this.currentMessageBuilder.chatId}, isCancelled was: ${this.isCancelled}`);
    this.currentMessageBuilder = {
      thinking: undefined,
      toolCalls: new Map(),
      content: '',
      contentBlocks: [],
      messageId: undefined,
      chatId: this.currentMessageBuilder.chatId  // ✅ 保留 chatId，因为可能在同一会话中
    };
    this.processedEventIds.clear();
    this.isCancelled = false;
  }

  // ✅ 内部重置构建器（完成/失败/取消后调用，清除 chatId）
  private clearMessageBuilder() {
    this.currentMessageBuilder = {
      thinking: undefined,
      toolCalls: new Map(),
      content: '',
      contentBlocks: [],
      messageId: undefined,
      chatId: undefined
    };
  }

  // ✅ 公共方法：更新工具调用状态（减少重复代码）
  private updateToolCallStatus(
    toolId: string | undefined,
    status: 'success' | 'error',
    data: { result?: unknown; error?: string },
    originalMessage: { session_id?: string }
  ) {
    if (!toolId) return;

    const endTime = Date.now();

    // 1. 更新 toolCalls Map 中的状态
    const toolCall = this.currentMessageBuilder.toolCalls?.get(toolId);
    if (toolCall) {
      toolCall.status = status;
      toolCall.endTime = endTime;
      if (data.result !== undefined) toolCall.result = data.result;
      if (data.error !== undefined) toolCall.error = data.error;
      if (toolCall.startTime) {
        toolCall.duration = (endTime - toolCall.startTime) / 1000;
      }
    } else {
      logger.warn(`⚠️ 未找到对应的工具调用: ${toolId}`);
    }

    // 2. 更新 contentBlocks 中的状态 (这是 UI 渲染的关键)
    if (this.currentMessageBuilder.contentBlocks) {
      const blockIndex = this.currentMessageBuilder.contentBlocks.findIndex(
        block => block.type === 'tool_call' && block.toolCall.id === toolId
      );

      if (blockIndex !== -1) {
        const block = this.currentMessageBuilder.contentBlocks[blockIndex];
        block.toolCall.status = status;
        block.toolCall.endTime = endTime;
        if (data.result !== undefined) block.toolCall.result = data.result;
        if (data.error !== undefined) block.toolCall.error = data.error;
        if (block.toolCall.startTime) {
          block.toolCall.duration = (endTime - block.toolCall.startTime) / 1000;
        }
        logger.debug(`✅ 更新了 contentBlock 中的工具状态:`, block.toolCall);
      }
    }

    // 3. 触发 UI 更新
    this.updateCurrentMessage({
      toolCalls: Array.from(this.currentMessageBuilder.toolCalls?.values() || []),
      contentBlocks: this.currentMessageBuilder.contentBlocks
    }, originalMessage);
  }

  // ✅ 使用 requestAnimationFrame 实现丝滑更新（2025最佳实践）
  // ✅ 已移除 scheduleUpdate 和 flushUpdates 方法
  // 原因：RAF 批处理机制导致流式事件被合并，用户看不到流畅的逐字显示效果
  // 现在直接调用 updateCurrentMessage 立即更新 UI

  handleMessage = (message: WebSocketMessage) => {
    try {
      // ✅ 丢弃已取消查询的残留消息（abort 后后端可能还会发送一些消息）
      if (this.isCancelled) {
        logger.debug(`🗑️ [handleMessage] 丢弃已取消查询的残留消息 - type: ${message.type}, isCancelled: true, messageId: ${this.currentMessageBuilder.messageId}`);
        return;
      }

      switch (message.type) {
        // ========== 旧格式（向后兼容）==========
        case 'stream_start':
          this.handleStreamStart(message);
          break;
        case 'stream_chunk':
        case 'chunk':  // ✅ 新增：支持后端的 chunk 类型
          this.handleStreamChunk(message as StreamChunkMessage);
          break;
        case 'stream_end':
          this.handleStreamEnd(message);
          break;
        case 'completion':
        case 'complete':  // ✅ 新增：支持后端的 complete 类型
          this.handleCompletion(message as CompletionMessage);
          break;
        case 'response':
          this.handleResponse(message);
          break;
        case 'thinking':
          this.handleThinking(message);
          break;

        // ========== 新格式（Agent 工作流程）==========
        case 'message_start':  // ✅ 新增：处理消息开始事件
          this.handleMessageStart(message);
          break;
        case 'thinking_start':
          this.handleThinkingStart(message);
          break;
        case 'thinking_step':
          this.handleThinkingStep(message);
          break;
        case 'thinking_end':
          this.handleThinkingEnd(message);
          break;
        case 'tool_call_start':
          this.handleToolCallStart(message);
          break;
        case 'tool_call_progress':
          this.handleToolCallProgress(message);
          break;
        case 'tool_call_result':
          this.handleToolCallResult(message);
          break;
        case 'tool_call_error':
          this.handleToolCallError(message);
          break;
        case 'content_delta':
          this.handleContentDelta(message);
          break;
        case 'message_complete':
          this.handleMessageComplete(message);
          break;
        case 'error':
          this.handleError(message);
          break;

        // ✅ 新增: 取消相关消息
        case 'generation_cancelled':
          this.handleGenerationCancelled(message);
          break;
        case 'cancellation_acknowledged':
          this.handleCancellationAcknowledged(message);
          break;

        // ✅ 新增: 状态提示消息
        case 'status':
          this.handleStatusMessage(message);
          break;

        // ✅ P2修复：处理session续期事件
        case 'session_renewed':
          this.handleSessionRenewed(message);
          break;

        // ✅ 新增: 后端创建Session后返回session_id
        case 'session_created':
          this.handleSessionCreated(message);
          break;

        // ✅ 新增: Token 使用统计
        case 'token_usage':
          this.handleTokenUsage(message);
          break;

        // ✅ 新增: 系统消息（欢迎消息等）
        case 'system':
          // 系统消息通常只是通知，不需要特殊处理
          logger.debug('📢 收到系统消息:', message.content || message);
          break;

        default:
          logger.warn('未知的消息类型:', message.type);
      }
    } catch (error) {
      logger.error('处理消息时出错:', error);
      notification.error({
        message: i18n.t('error:messageHandler.processingError'),
        description: i18n.t('error:messageHandler.processingErrorDesc')
      });
    }
  };



  private handleStreamStart = (_message: WebSocketMessage): void => {
    void _message; // 显式忽略未使用参数
    const messageId = this.getCurrentMessageId();
    if (messageId) {
      // 更新消息状态为流式输出
      const currentChatId = this.chatStore.currentChatId;
      if (currentChatId) {
        const currentMessage = this.getCurrentMessage();
        if (currentMessage) {
          this.chatStore.updateMessage(currentChatId, messageId, {
            meta: {
              ...currentMessage.meta,
              status: 'streaming',
              isStreaming: true
            }
          });
        }
      }
    }
  };

  private handleStreamChunk = (message: StreamChunkMessage & { session_id?: string }) => {
    // 🔍 诊断：记录收到的chunk事件
    logger.debug('📥 [前端] 收到 chunk 事件, content长度:', message.content?.length, '预览:', message.content?.substring(0, 50), 'session_id:', message.session_id);

    const content = message.content || '';

    // ✅ 确保当前消息存在（传递message以使用session_id）
    this.ensureCurrentMessage(message);

    // ✅ 更新当前消息构建器
    this.currentMessageBuilder.content += content;

    // ✅ 更新contentBlocks
    if (!this.currentMessageBuilder.contentBlocks) {
      this.currentMessageBuilder.contentBlocks = [];
    }

    // ✅ 查找或创建最后一个text块
    if (this.currentMessageBuilder.contentBlocks.length > 0) {
      const lastBlock = this.currentMessageBuilder.contentBlocks[this.currentMessageBuilder.contentBlocks.length - 1];
      if (lastBlock.type === 'text') {
        // 累积到现有text块
        lastBlock.content += content;
        logger.debug('📝 [前端] 累积到现有text块, 总长度:', lastBlock.content.length);
      } else {
        // 最后一个块不是text，创建新的text块
        this.currentMessageBuilder.contentBlocks.push({
          type: 'text',
          content: content,
          timestamp: Date.now()
        });
        logger.debug('➕ [前端] 创建新text块（最后一个不是text）, contentBlocks总数:', this.currentMessageBuilder.contentBlocks.length);
      }
    } else {
      // 没有contentBlocks，创建第一个text块
      this.currentMessageBuilder.contentBlocks.push({
        type: 'text',
        content: content,
        timestamp: Date.now()
      });
      logger.debug('➕ [前端] 创建第一个text块, contentBlocks总数:', this.currentMessageBuilder.contentBlocks.length);
    }

    // ✅ 直接调用 updateCurrentMessage，不使用 RAF 批处理
    // 这样可以实现真正的流式输出，每个 chunk 立即显示在 UI 上
    this.updateCurrentMessage({
      content: this.currentMessageBuilder.content,
      contentBlocks: this.currentMessageBuilder.contentBlocks,
      showStatus: false  // 隐藏状态卡片
    }, message);
  };

  private handleStreamEnd = (_message: WebSocketMessage): void => {
    void _message; // 显式忽略未使用参数
    const messageId = this.getCurrentMessageId();
    const currentChatId = this.chatStore.currentChatId;

    if (messageId && currentChatId) {
      const currentMessage = this.getCurrentMessage();
      if (currentMessage) {
        this.chatStore.updateMessage(currentChatId, messageId, {
          meta: {
            ...currentMessage.meta,
            status: 'completed',
            isStreaming: false,
            streamingProgress: 100,
            endTime: Date.now()
          }
        });
      }
    }
  };

  private handleCompletion = (message: CompletionMessage) => {
    const { success, error } = message;
    const messageId = this.getCurrentMessageId();

    logger.debug('✅ [messageHandler.handleCompletion] 收到 complete 事件, success:', success, 'error:', error);
    logger.debug('🔍 [handleCompletion] complete 事件完整内容:', message);

    // ✅ 检查 complete 事件中是否包含 token_usage
    const tokenUsageFromComplete = (message as any).token_usage;
    if (tokenUsageFromComplete) {
      logger.debug('📊 [handleCompletion] complete 事件包含 token_usage:', tokenUsageFromComplete);
    } else {
      logger.warn('⚠️ [handleCompletion] complete 事件缺少 token_usage 字段');
    }

    if (messageId) {
      // 更新消息状态
      const currentChatId = this.chatStore.currentChatId;
      if (currentChatId) {
        const currentMessage = this.getCurrentMessage();
        if (currentMessage) {
          // ✅ 如果失败，不将错误信息添加到消息内容中（由 Alert 统一显示，避免重复）
          // 保持原有内容不变，错误信息通过 Alert 组件显示
          const updatedContent = currentMessage.content;

          // ✅ 构建更新对象
          const updateData: any = {
            content: updatedContent,
            meta: {
              ...currentMessage.meta,
              status: success ? 'completed' : 'failed',
              isStreaming: false,  // ✅ 关键：停止流式状态
              streamingProgress: 100,
              endTime: Date.now(),
              error: error ? {
                message: error,
                code: undefined,
                retryable: true
              } : undefined
            },
            // ✅ 清除状态卡片显示（避免继续显示"正在分析数据..."）
            showStatus: false,
            statusType: undefined,
            statusMessage: undefined
          };

          // ✅ 如果 complete 事件包含 token_usage，添加到消息中
          if (tokenUsageFromComplete) {
            updateData.tokenUsage = {
              input_tokens: tokenUsageFromComplete.input_tokens || 0,
              output_tokens: tokenUsageFromComplete.output_tokens || 0,
              cache_read_tokens: tokenUsageFromComplete.cache_read_tokens || 0,
              cache_write_tokens: tokenUsageFromComplete.cache_write_tokens || 0,
              input_cache_hit_rate: tokenUsageFromComplete.input_cache_hit_rate || 0,
              output_cache_hit_rate: tokenUsageFromComplete.output_cache_hit_rate || 0
            };
            logger.debug('✅ [handleCompletion] Token 统计已添加到消息');
          }

          this.chatStore.updateMessage(currentChatId, messageId, updateData);
        }
      }
    }

    // ✅ 处理错误情况：无论是否有 error 字段，只要 success 为 false 就显示错误
    if (!success) {
      const errorMessage = error || i18n.t('error:messageHandler.requestFailed');
      logger.error('❌ [messageHandler.handleCompletion] 查询失败:', errorMessage);
      notification.error({
        message: i18n.t('error:messageHandler.processingFailed'),
        description: errorMessage,
        duration: 5
      });
    }

    // ✅ 调用重置查询回调，恢复输入框状态（无论成功或失败都要重置）
    logger.debug('🔴 [messageHandler.handleCompletion] 调用 resetCurrentQuery()');
    if (this.resetCurrentQuery) {
      this.resetCurrentQuery();
    } else {
      logger.error('❌ [messageHandler.handleCompletion] resetCurrentQuery 未设置！');
    }

    // ✅ 清理已处理事件ID集合（为下一次查询准备）
    this.processedEventIds.clear();
    logger.debug('🧹 [前端] 已清理事件去重集合');

    // ✅ 重置构建器，防止后续残留事件修改已完成的消息
    this.clearMessageBuilder();
    logger.debug('✅ [前端] 消息完成，已重置构建器');
  };

  private handleThinking = (message: WebSocketMessage) => {
    // ✅ 兼容后端发送的 thinking 事件，映射到 thinking_step
    logger.debug('🧠 [前端] 收到 thinking 事件:', message.content);

    // 确保有当前消息
    this.ensureCurrentMessage();

    // 如果还没有开始思考，初始化思考状态
    if (!this.currentMessageBuilder.thinking) {
      this.handleThinkingStart(message);
    }

    //作为思考步骤处理
    this.handleThinkingStep({ content: message.content || i18n.t('error:messageHandler.thinking') });
  };

  private handleMessageStart = (message: WebSocketMessage & { session_id?: string }) => {
    logger.debug('🚀 [前端] 收到 message_start 事件, session_id:', message.session_id);
    this.ensureCurrentMessage(message);

    // 更新消息状态
    this.updateCurrentMessage({
      meta: {
        status: 'streaming',
        isStreaming: true
      }
    }, message);
  };

  private handleResponse = (message: WebSocketMessage) => {
    // ✅ 处理 response 类型消息（用于错误提示、账号配置提示等）
    const content = (message.content as string) || '';

    if (!content) {
      logger.warn('⚠️ [handleResponse] 收到空的 response 消息');
      return;
    }

    logger.debug('📥 [handleResponse] 收到 response 消息，内容长度:', content.length);

    // ✅ 确保当前消息存在（传递message以使用session_id）
    this.ensureCurrentMessage(message);

    // ✅ 更新当前消息构建器
    this.currentMessageBuilder.content = content;

    // ✅ 更新contentBlocks（创建text块）
    if (!this.currentMessageBuilder.contentBlocks) {
      this.currentMessageBuilder.contentBlocks = [];
    }

    // ✅ 创建或更新text块
    if (this.currentMessageBuilder.contentBlocks.length > 0) {
      const lastBlock = this.currentMessageBuilder.contentBlocks[this.currentMessageBuilder.contentBlocks.length - 1];
      if (lastBlock.type === 'text') {
        // 更新现有text块
        lastBlock.content = content;
      } else {
        // 最后一个块不是text，创建新的text块
        this.currentMessageBuilder.contentBlocks.push({
          type: 'text',
          content: content,
          timestamp: Date.now()
        });
      }
    } else {
      // 没有contentBlocks，创建第一个text块
      this.currentMessageBuilder.contentBlocks.push({
        type: 'text',
        content: content,
        timestamp: Date.now()
      });
    }

    // ✅ 直接调用 updateCurrentMessage，不使用 RAF 批处理
    this.updateCurrentMessage({
      content: this.currentMessageBuilder.content,
      contentBlocks: this.currentMessageBuilder.contentBlocks,
      showStatus: false  // 隐藏状态卡片
    }, message);
  };

  private getCurrentMessageId = (): string | null => {
    const currentChatId = this.chatStore.currentChatId;
    if (!currentChatId) return null;

    const messages = this.chatStore.messages[currentChatId] || [];
    const lastMessage = messages[messages.length - 1];

    return lastMessage?.type === 'assistant' ? lastMessage.id : null;
  };

  private getCurrentMessage = () => {
    const messageId = this.getCurrentMessageId();
    const currentChatId = this.chatStore.currentChatId;

    if (!messageId || !currentChatId) return null;

    const messages = this.chatStore.messages[currentChatId] || [];
    return messages.find(m => m.id === messageId);
  };

  // ========== 新格式消息处理器 ==========

  private handleThinkingStart = (_message: WebSocketMessage): void => {
    void _message; // 显式忽略未使用参数
    // 初始化思考数据
    this.currentMessageBuilder.thinking = {
      steps: [],
      startTime: Date.now()
    };

    // 创建一个新的 Assistant 消息（如果还没有）
    this.ensureCurrentMessage();

    // ✨ 立即更新消息，显示空的思考过程（会显示加载状态）
    this.updateCurrentMessage({
      thinking: {
        steps: [],
        startTime: this.currentMessageBuilder.thinking.startTime
      }
    });
  };

  private handleThinkingStep = (message: { content?: string; session_id?: string }) => {
    const { content } = message;

    if (!this.currentMessageBuilder.thinking) {
      this.currentMessageBuilder.thinking = { steps: [] };
    }

    if (!this.currentMessageBuilder.thinking.steps) {
      this.currentMessageBuilder.thinking.steps = [];
    }

    this.currentMessageBuilder.thinking.steps.push(content);

    // ✅ 实时更新 UI，不使用 RAF 批处理
    this.updateCurrentMessage({
      thinking: {
        steps: this.currentMessageBuilder.thinking.steps,
        startTime: this.currentMessageBuilder.thinking.startTime
      }
    }, message);
  };

  private handleThinkingEnd = (message: { duration?: number }) => {
    const { duration } = message;

    logger.debug(`🧠 [前端] 收到思考结束事件, duration:`, duration);

    if (this.currentMessageBuilder.thinking) {
      this.currentMessageBuilder.thinking.duration = duration;
      this.currentMessageBuilder.thinking.endTime = Date.now();

      // 更新消息
      this.updateCurrentMessage({
        thinking: {
          steps: this.currentMessageBuilder.thinking.steps || [],
          duration: duration,
          startTime: this.currentMessageBuilder.thinking.startTime,
          endTime: this.currentMessageBuilder.thinking.endTime
        }
      });

      logger.debug(`🧠 [前端] 思考数据已更新:`, this.currentMessageBuilder.thinking);
    }
  };

  private handleToolCallStart = (message: { tool_id?: string; tool_name?: string; description?: string; args?: Record<string, unknown>; update?: boolean; session_id?: string }) => {
    const { tool_id, tool_name, description, args, update } = message;

    // ✅ 添加详细时间戳日志（调试顺序问题）
    const timestamp = new Date().toISOString();
    logger.debug(`⏰ [${timestamp}] handleToolCallStart - tool_id: ${tool_id}, tool_name: ${tool_name}, session_id: ${message.session_id}`);

    // 🔄 如果这是一个更新事件（包含额外参数）
    if (update && tool_id) {
      logger.debug(`⏰ [${timestamp}] 🔄 收到工具调用参数更新:`, tool_id, 'session_id:', message.session_id);

      // 更新 toolCalls Map 中的参数
      const existingToolCall = this.currentMessageBuilder.toolCalls?.get(tool_id);
      if (existingToolCall) {
        existingToolCall.args = args; // 更新为完整参数
        logger.debug('✅ [前端] 已更新工具调用参数:', args);
      }

      // 更新 contentBlocks 中的参数
      if (this.currentMessageBuilder.contentBlocks) {
        const blockIndex = this.currentMessageBuilder.contentBlocks.findIndex(
          block => block.type === 'tool_call' && block.toolCall.id === tool_id
        );
        if (blockIndex !== -1) {
          this.currentMessageBuilder.contentBlocks[blockIndex].toolCall.args = args;
        }
      }

      // ✅ 触发 UI 更新，不使用 RAF 批处理
      this.updateCurrentMessage({
        toolCalls: Array.from(this.currentMessageBuilder.toolCalls?.values() || []) as ToolCallData[],
        contentBlocks: this.currentMessageBuilder.contentBlocks
      }, message);

      return; // 更新事件处理完成，直接返回
    }

    // ✅ 去重检查：防止重复处理同一个工具调用
    if (tool_id && this.processedEventIds.has(tool_id)) {
      logger.warn('⚠️ [前端去重] 检测到重复工具调用事件，已忽略:', tool_id);
      return;
    }

    // ✅ 记录已处理的事件ID
    if (tool_id) {
      this.processedEventIds.add(tool_id);
    }

    // 🔍 详细诊断日志
    logger.debug('📥 [前端] 收到 tool_call_start 事件:', {
      tool_id,
      tool_name,
      description,
      args,
      argsType: typeof args,
      argsKeys: args ? Object.keys(args) : []
    });

    if (!this.currentMessageBuilder.toolCalls) {
      this.currentMessageBuilder.toolCalls = new Map();
    }

    const toolCallData = {
      id: tool_id,
      name: tool_name,
      description: description,
      status: 'calling',
      args: args,
      startTime: Date.now()
    };

    this.currentMessageBuilder.toolCalls.set(tool_id, toolCallData);

    // ✨ 添加工具调用块到内容块列表
    if (!this.currentMessageBuilder.contentBlocks) {
      this.currentMessageBuilder.contentBlocks = [];
    }

    this.currentMessageBuilder.contentBlocks.push({
      type: 'tool_call',
      toolCall: toolCallData,
      timestamp: Date.now()
    });

    logger.debug('✅ [前端] 添加工具调用到 contentBlocks, 当前总数:', this.currentMessageBuilder.contentBlocks.length, 'session_id:', message.session_id);

    // ✅ 实时更新 UI，不使用 RAF 批处理
    this.updateCurrentMessage({
      toolCalls: Array.from(this.currentMessageBuilder.toolCalls.values()) as ToolCallData[],
      contentBlocks: this.currentMessageBuilder.contentBlocks
    }, message);
  };

  private handleToolCallProgress = (message: { tool_id?: string; status?: string }) => {
    const { tool_id, status } = message;

    const toolCall = this.currentMessageBuilder.toolCalls?.get(tool_id);
    if (toolCall) {
      logger.debug(`工具 ${tool_id} 进度: ${status}`);
    }
  };

  private handleToolCallResult = (message: { tool_use_id?: string; result?: unknown; status?: string; session_id?: string }) => {
    const { tool_use_id, result, status } = message;
    logger.debug('📥 [前端] 收到 tool_call_result 事件:', message, 'session_id:', message.session_id);

    // 使用公共方法更新工具调用状态
    this.updateToolCallStatus(
      tool_use_id,
      (status as 'success' | 'error') || 'success',
      { result },
      message
    );
  };

  private handleToolCallError = (message: { tool_use_id?: string; error?: string; session_id?: string }) => {
    const { tool_use_id, error } = message;

    // 使用公共方法更新工具调用状态
    this.updateToolCallStatus(
      tool_use_id,
      'error',
      { error },
      message
    );
  };

  private handleContentDelta = (message: { delta?: string; session_id?: string }) => {
    const { delta } = message;

    this.currentMessageBuilder.content += delta;

    // ✨ 合并文本块：如果最后一个块是文本，就追加；否则创建新块
    if (delta) {
      if (!this.currentMessageBuilder.contentBlocks) {
        this.currentMessageBuilder.contentBlocks = [];
      }

      const lastBlock = this.currentMessageBuilder.contentBlocks[this.currentMessageBuilder.contentBlocks.length - 1];

      if (lastBlock && lastBlock.type === 'text') {
        // 最后一个是文本块，追加内容
        lastBlock.content += delta;
      } else {
        // 最后一个不是文本块（或没有块），创建新的文本块
        this.currentMessageBuilder.contentBlocks.push({
          type: 'text',
          content: delta,
          timestamp: Date.now()
        });
      }
    }

    // ✅ 直接调用 updateCurrentMessage，不使用 RAF 批处理
    // 这样可以实现真正的流式输出，每个 delta 立即显示在 UI 上
    this.updateCurrentMessage({
      content: this.currentMessageBuilder.content,
      contentBlocks: this.currentMessageBuilder.contentBlocks,
      meta: {
        status: 'streaming',
        isStreaming: true  // ✅ 明确设置流式状态
      },
      showStatus: false  // 隐藏状态卡片
    }, message);
  };

  private handleMessageComplete = (message: { session_id?: string; query_id?: string }) => {
    logger.debug('✅ [messageHandler.handleMessageComplete] 收到 message_complete 事件, session_id:', message.session_id);

    // ✅ 优先使用消息中的 session_id
    const sessionId = message?.session_id;
    const currentChatId = sessionId || this.currentMessageBuilder.chatId || this.chatStore.currentChatId;

    if (!currentChatId || !this.currentMessageBuilder.messageId) {
      logger.warn('⚠️ [messageHandler.handleMessageComplete] 没有当前聊天或消息ID');
      return;
    }

    // ✅ 获取当前消息（使用正确的chatId）
    const messages = this.chatStore.messages[currentChatId] || [];
    const currentMessage = messages.find(m => m.id === this.currentMessageBuilder.messageId);

    // ✅ 检查是否有暂存的 Token 统计（修复竞态条件）
    const query_id = message?.query_id;
    if (query_id && this.pendingTokenUsage.has(query_id)) {
      const tokenUsage = this.pendingTokenUsage.get(query_id);
      logger.debug('📊 应用暂存的 Token 统计:', tokenUsage);

      this.chatStore.updateMessage(currentChatId, this.currentMessageBuilder.messageId, {
        tokenUsage
      });

      this.pendingTokenUsage.delete(query_id);
    }

    // 标记消息完成
    this.chatStore.updateMessage(currentChatId, this.currentMessageBuilder.messageId, {
      meta: {
        ...currentMessage?.meta,
        status: 'completed' as const,
        isStreaming: false,
        streamingProgress: 100,
        endTime: Date.now()
      }
    });

    logger.debug(`✅ 消息已标记为完成 - chatId: ${currentChatId}, messageId: ${this.currentMessageBuilder.messageId}`);

    // ✅ 调用重置查询回调，更新 currentQueryId
    logger.debug('🔴 [messageHandler.handleMessageComplete] 调用 resetCurrentQuery()');
    if (this.resetCurrentQuery) {
      this.resetCurrentQuery();
    } else {
      logger.error('❌ [messageHandler.handleMessageComplete] resetCurrentQuery 未设置！');
    }

    // ✅ 重置构建器
    this.clearMessageBuilder();
  };

  private handleError = (message: WebSocketMessage & { error?: string; session_id?: string }) => {
    const { error } = message;
    // ✅ 已移除 flushUpdates 调用，不再需要批处理机制

    const errorMessage = error || '未知错误';
    const sessionId = message.session_id || '无';

    logger.debug('❌ [messageHandler.handleError] 收到错误:', {
      error: errorMessage,
      session_id: sessionId,
      fullMessage: message
    });

    notification.error({
      message: i18n.t('error:messageHandler.processingFailed'),
      description: errorMessage,
      duration: 5
    });

    // ✅ 调用重置查询回调，更新 currentQueryId
    if (this.resetCurrentQuery) {
      this.resetCurrentQuery();
    }

    // 如果有当前消息，标记为失败
    const currentChatId = sessionId || this.currentMessageBuilder.chatId || this.chatStore.currentChatId;

    if (currentChatId && this.currentMessageBuilder.messageId) {
      const messages = this.chatStore.messages[currentChatId] || [];
      const currentMessage = messages.find(m => m.id === this.currentMessageBuilder.messageId);

      this.chatStore.updateMessage(currentChatId, this.currentMessageBuilder.messageId, {
        meta: {
          ...currentMessage?.meta,
          status: 'failed' as const,
          error: {
            message: error,
            code: undefined,
            retryable: true
          }
        }
      });
    }

    // ✅ 重置构建器，防止后续残留事件修改已失败的消息
    this.clearMessageBuilder();
  };

  // ✅ 新增: 处理生成取消事件
  private handleGenerationCancelled = (message: { reason?: string; message?: string; query_id?: string; session_id?: string }) => {
    const { query_id } = message;
    // ✅ 后端发送的是 message 字段而非 reason 字段，需要兼容两者
    const cancelReason = message.reason || message.message || 'generation_cancelled';

    logger.debug(`🔍 [handleGenerationCancelled] 收到事件 - query_id: ${query_id}, reason: ${cancelReason}, isCancelled: ${this.isCancelled}, messageId: ${this.currentMessageBuilder.messageId}, chatId: ${this.currentMessageBuilder.chatId}, currentQueryId: ${this.currentQueryId}`);

    // ✅ 关键修复：如果事件的 query_id 与当前查询不匹配，忽略
    // 场景：第一次查询被取消后，后端的 generation_cancelled 事件在第二次查询的 SSE 流中到达
    if (query_id && this.currentQueryId && query_id !== this.currentQueryId) {
      logger.debug(`⏭️ [handleGenerationCancelled] query_id 不匹配，忽略 - 事件: ${query_id}, 当前: ${this.currentQueryId}`);
      return;
    }

    const sessionId = message?.session_id;
    const currentChatId = sessionId || this.currentMessageBuilder.chatId || this.chatStore.currentChatId;

    if (!currentChatId || !this.currentMessageBuilder.messageId) {
      logger.warn('⚠️ [handleGenerationCancelled] 无法标记取消状态：没有当前聊天或消息');
      return;
    }

    const messages = this.chatStore.messages[currentChatId] || [];
    const currentMessage = messages.find(m => m.id === this.currentMessageBuilder.messageId);

    // ✅ 关键修复：如果消息已经处于终态（completed/failed/cancelled），不再覆盖
    // 场景：查询正常完成后，watch_disconnect 检测到连接断开，后端发送 generation_cancelled
    // 此时消息已经是 completed 状态，不应被覆盖为 cancelled
    const terminalStatuses = ['completed', 'failed', 'cancelled'];
    if (currentMessage && terminalStatuses.includes(currentMessage.meta?.status)) {
      logger.debug(`⏭️ [handleGenerationCancelled] 消息已处于终态 (${currentMessage.meta.status})，忽略 generation_cancelled - Query: ${query_id}`);
      return;
    }

    logger.debug(`🛑 生成已取消 - Query: ${query_id}, ChatId: ${currentChatId}, Reason: ${cancelReason}`);

    // 更新消息状态为"已取消"
    this.chatStore.updateMessage(
      currentChatId,
      this.currentMessageBuilder.messageId,
      {
        meta: {
          ...currentMessage?.meta,
          status: 'cancelled' as const,
          isStreaming: false,
          streamingProgress: 100,
          endTime: Date.now(),
          cancelReason: cancelReason,
          retryCount: currentMessage?.meta.retryCount || 0,
          maxRetries: currentMessage?.meta.maxRetries || 3,
          canRetry: true,
          canEdit: false,
          canDelete: true
        },
        // ✅ 清除状态卡片显示（避免继续显示"正在分析数据..."）
        showStatus: false,
        statusType: undefined,
        statusMessage: undefined
      }
    );

    // ✅ 调用重置查询回调，更新 currentQueryId
    if (this.resetCurrentQuery) {
      this.resetCurrentQuery();
    }

    // ✅ 重置构建器
    this.clearMessageBuilder();
  };

  // ✅ 新增: 处理取消确认事件
  private handleCancellationAcknowledged = (message: { query_id?: string }) => {
    const { query_id } = message;
    logger.debug(`✅ 取消确认 - Query: ${query_id}`);

    // 可以在这里添加额外的UI反馈（如果需要）
  };

  // ========== 辅助方法 ==========

  private ensureCurrentMessage = (message?: { session_id?: string }) => {
    // ✅ 优先使用消息中的 session_id，否则回退到 currentChatId
    const sessionId = message?.session_id;
    let currentChatId = sessionId || this.chatStore.currentChatId;

    // ✅ 如果 currentChatId 为空，创建一个新会话（用于显示错误消息等）
    if (!currentChatId) {
      logger.warn('⚠️ [ensureCurrentMessage] currentChatId 为空，创建新会话');
      // ✅ createNewChat 现在是同步的，立即创建临时会话
      currentChatId = this.chatStore.createNewChat();
      logger.debug(`✅ [ensureCurrentMessage] 已创建新会话: ${currentChatId}`);
    }

    // 如果已经有当前消息，检查是否归属于同一个会话
    if (this.currentMessageBuilder.messageId) {
      const existingChatId = this.currentMessageBuilder.chatId;
      if (existingChatId !== currentChatId) {
        // 不同的会话，重置构建器（可能是新查询）
        logger.warn(`⚠️ 检测到会话切换: ${existingChatId} → ${currentChatId}，重置消息构建器`);
        this.clearMessageBuilder();
      } else {
        // ✅ 同一个会话，但需要检查是否是新查询
        // 如果消息已经标记为完成（通过 message_complete 事件），则应该创建新消息
        // 这里我们继续使用现有消息，因为 message_complete 会重置 messageId
        logger.debug(`♻️  复用现有消息 - chatId: ${currentChatId}, messageId: ${this.currentMessageBuilder.messageId}`);
        return;
      }
    }

    // ✅ 检查是否已存在占位消息（由 MessageInput 创建）
    // 查找最后一个助手消息，如果是待处理状态，则复用它
    const messages = this.chatStore.messages[currentChatId] || [];
    const lastMessage = messages[messages.length - 1];

    logger.debug(`🔍 [ensureCurrentMessage] 查找占位消息 - lastMessage: type=${lastMessage?.type}, status=${lastMessage?.meta?.status}, content="${lastMessage?.content?.substring(0, 20)}", id=${lastMessage?.id}`);

    if (lastMessage &&
        lastMessage.type === 'assistant' &&
        (lastMessage.meta?.status === 'pending' || lastMessage.meta?.status === 'streaming') &&
        lastMessage.content === '') {
      // 复用现有的占位消息
      this.currentMessageBuilder.messageId = lastMessage.id;
      this.currentMessageBuilder.chatId = currentChatId;
      logger.debug(`♻️  复用占位消息 - chatId: ${currentChatId}, messageId: ${lastMessage.id}`);
      return;
    }

    // 创建新的 Assistant 消息（只在没有占位消息时）
    const messageId = Date.now().toString() + '_' + Math.random().toString(36).slice(2, 11);
    this.currentMessageBuilder.messageId = messageId;
    this.currentMessageBuilder.chatId = currentChatId;  // ✅ 记录消息归属的 chatId

    // 确保会话存在
    if (!this.chatStore.chats[currentChatId]) {
      logger.warn(`⚠️ 会话 ${currentChatId} 不存在，可能是后端创建的新会话，等待 session_created 事件`);
      // 创建临时会话占位符（稍后由 session_created 更新）
      this.chatStore.chats[currentChatId] = {
        id: currentChatId,
        title: '新对话',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.chatStore.messages[currentChatId] = [];
    }

    this.chatStore.addMessage(currentChatId, {
      id: messageId,
      chatId: currentChatId,
      type: 'assistant',
      content: '',
      timestamp: Date.now(),
      meta: {
        status: 'streaming' as const,
        isStreaming: true,
        streamingProgress: 0,
        retryCount: 0,
        maxRetries: 3,
        canRetry: true,
        canEdit: false,
        canDelete: true
      }
    });

    logger.debug(`✅ 创建新消息 - chatId: ${currentChatId}, messageId: ${messageId}, 来源: ${sessionId ? 'session_id' : 'currentChatId'}`);
  };

  private updateCurrentMessage = (updates: MessageUpdate, message?: { session_id?: string }) => {
    // ✅ 优先使用消息中的 session_id
    const sessionId = message?.session_id;
    const currentChatId = sessionId || this.currentMessageBuilder.chatId || this.chatStore.currentChatId;

    if (!currentChatId || !this.currentMessageBuilder.messageId) {
      this.ensureCurrentMessage(message);
      if (!this.currentMessageBuilder.messageId) {
        logger.error('❌ [updateCurrentMessage] ensureCurrentMessage 失败');
        return;
      }
    }

    // ✅ 验证消息归属
    const targetChatId = this.currentMessageBuilder.chatId || currentChatId;
    if (targetChatId !== currentChatId && sessionId) {
      logger.warn(`⚠️ 消息归属不匹配: builder=${this.currentMessageBuilder.chatId}, message=${currentChatId}`);
      // 使用消息中的 session_id 作为最终真相
      this.currentMessageBuilder.chatId = currentChatId;
    }

    this.chatStore.updateMessage(targetChatId!, this.currentMessageBuilder.messageId!, updates);
  };

  // ========== 状态提示消息处理 ==========

  private handleStatusMessage = (message: { status_type?: string; message?: string; estimated_seconds?: number; details?: string[]; session_id?: string }) => {
    const { status_type, message: statusMessage, estimated_seconds, details } = message;

    logger.debug('📊 收到状态消息:', { status_type, message: statusMessage });

    // ✅ 关键修复：确保有当前消息（传递message以使用session_id）
    this.ensureCurrentMessage(message);

    if (!this.currentMessageBuilder.messageId) {
      logger.warn('⚠️  无法处理状态消息：没有当前消息ID');
      return;
    }

    // ✅ 关键修复：更新消息的状态信息（传递message以使用session_id）
    this.updateCurrentMessage({
      statusType: status_type,
      statusMessage: statusMessage,
      statusEstimatedSeconds: estimated_seconds,
      statusDetails: details,
      showStatus: true  // ✅ 强制显示状态卡片！
    }, message);

    logger.debug('✅ 状态卡片已更新:', { statusType: status_type, showStatus: true, messageId: this.currentMessageBuilder.messageId });
  };

  // ✅ 新增：处理后端返回的 session_id（简化版）
  // ✅ 现在前端已经知道 session_id（因为是自己生成的），只需要验证确认
  private handleSessionCreated = (message: { session_id?: string; query_id?: string }) => {
    const { session_id, query_id } = message;

    logger.debug('🆕 收到后端确认的 session_id:', session_id, 'for query:', query_id);

    const currentChatId = this.chatStore.currentChatId;

    // ✅ 前端已经知道 session_id（因为是自己生成的）
    // ✅ 只需要验证是否匹配，不需要迁移
    if (currentChatId !== session_id) {
      logger.warn(`⚠️ session_id 不匹配 - currentChatId: ${currentChatId}, session_id: ${session_id}`);

      // ✅ 如果会话已存在，更新 currentChatId（后端确认了这个 session_id）
      if (this.chatStore.chats[session_id]) {
        logger.debug(`🔄 更新 currentChatId: ${currentChatId} → ${session_id}`);
        this.chatStore.currentChatId = session_id;
        this.chatStore.saveToStorage();
      } else {
        // ✅ 如果会话不存在，可能是后端创建的新会话（向后兼容）
        logger.debug(`📝 后端创建了新会话: ${session_id}，但前端没有对应的chat`);
        // 可以选择创建新的chat，或者忽略（取决于业务逻辑）
      }
    } else {
      logger.debug(`✅ session_id 匹配 - currentChatId: ${currentChatId}`);
    }

    // ✅ 不再需要迁移消息的逻辑（因为前端已经使用真实UUID）
    // ✅ 不再需要删除临时chat的逻辑（因为不再使用temp_xxx）
  };

  // ✅ 新增：处理 Token 使用统计（修复竞态条件）
  private handleTokenUsage = (message: TokenUsageMessage) => {
    const { usage, query_id } = message;

    if (!usage) {
      logger.warn('[handleTokenUsage] 无效的 token_usage 消息:', message);
      return;
    }

    logger.debug('📊 Token 统计:', {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cacheRead: usage.cache_read_tokens,
      inputCacheHitRate: `${usage.input_cache_hit_rate}%`
    });

    // 构建 tokenUsage 对象
    const tokenUsage = {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_tokens,
      cache_write_tokens: usage.cache_write_tokens,
      input_cache_hit_rate: usage.input_cache_hit_rate,
      output_cache_hit_rate: usage.output_cache_hit_rate
    };

    // 更新当前消息的 tokenUsage 字段
    const messageId = this.currentMessageBuilder.messageId;
    const chatId = this.currentMessageBuilder.chatId;

    if (!messageId || !chatId) {
      // ✅ 修复竞态条件：暂存 Token 统计，等待 message_complete 后应用
      logger.warn('[handleTokenUsage] messageId 或 chatId 不存在，暂存 Token 统计');
      if (query_id) {
        this.pendingTokenUsage.set(query_id, tokenUsage);
      }
      return;
    }

    // 直接调用 store 更新消息
    this.chatStore.updateMessage(chatId, messageId, { tokenUsage });

    logger.debug(`✅ Token 统计已更新到消息 ${messageId}`);
  };

  // ✅ P2修复：处理session续期事件
  private handleSessionRenewed = (message: { old_session_id?: string; new_session_id?: string; reason?: string; message?: string }) => {
    const { old_session_id, new_session_id, reason, message: msg } = message;

    logger.debug('🔄 Session续期:', {
      old: old_session_id,
      new: new_session_id,
      reason
    });

    // 1. 更新当前消息构建器的chatId
    if (this.currentMessageBuilder.chatId === old_session_id) {
      this.currentMessageBuilder.chatId = new_session_id;
      logger.debug(`✅ 更新消息构建器 chatId: ${old_session_id} → ${new_session_id}`);
    }

    // 2. 更新chatStore中的currentChatId（直接设置state）
    if (this.chatStore.currentChatId === old_session_id) {
      useChatStore.setState({ currentChatId: new_session_id });
      logger.debug(`✅ 更新 currentChatId: ${old_session_id} → ${new_session_id}`);
    }

    // 3. 迁移chat和messages到新session_id
    const oldChat = this.chatStore.chats[old_session_id];
    const oldMessages = this.chatStore.messages[old_session_id];

    if (oldChat) {
      // 创建新chat
      this.chatStore.chats[new_session_id] = {
        ...oldChat,
        id: new_session_id,
        updatedAt: Date.now()
      };

      // 迁移消息
      if (oldMessages && oldMessages.length > 0) {
        this.chatStore.messages[new_session_id] = oldMessages.map(msg => ({
          ...msg,
          chatId: new_session_id
        }));
      }

      // 删除旧chat和消息
      delete this.chatStore.chats[old_session_id];
      delete this.chatStore.messages[old_session_id];

      // 保存到localStorage
      this.chatStore.saveToStorage();
      logger.debug(`✅ 已迁移chat和消息到新session: ${new_session_id}`);
    }

    // 4. 显示通知（可选）
    notification.info({
      message: i18n.t('error:messageHandler.sessionRenewed'),
      description: msg || i18n.t('error:messageHandler.sessionRenewed'),
      duration: 3,
      placement: 'topRight'
    });
  };

  // ✅ 前端本地取消：abort 连接后后端的 generation_cancelled 消息无法到达，
  // 需要在前端直接清理消息状态（isStreaming、showStatus 等）
  handleLocalCancel = (reason?: string) => {
    // ✅ 设置取消标志，丢弃 abort 后到达的残留消息
    this.isCancelled = true;

    const currentChatId = this.currentMessageBuilder.chatId || this.chatStore.currentChatId;
    let messageId = this.currentMessageBuilder.messageId;

    logger.debug(`🔍 [handleLocalCancel] 开始 - reason: ${reason}, chatId: ${currentChatId}, messageId: ${messageId}, isCancelled: ${this.isCancelled}`);

    // ✅ 如果 messageHandler 还没有 messageId（后端还没发消息），
    // 直接查找占位消息（MessageInput 创建的 pending/streaming 状态的空 assistant 消息）
    if (!messageId && currentChatId) {
      const messages = this.chatStore.messages[currentChatId] || [];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage &&
          lastMessage.type === 'assistant' &&
          (lastMessage.meta?.status === 'pending' || lastMessage.meta?.status === 'streaming')) {
        messageId = lastMessage.id;
        logger.debug(`🔍 [handleLocalCancel] 找到占位消息 - MessageId: ${messageId}`);
      }
    }

    if (!currentChatId || !messageId) {
      logger.warn('⚠️ [handleLocalCancel] 无当前聊天或消息，跳过');
      return;
    }

    logger.debug(`🛑 [handleLocalCancel] 前端本地取消 - ChatId: ${currentChatId}, MessageId: ${messageId}`);

    const messages = this.chatStore.messages[currentChatId] || [];
    const currentMessage = messages.find(m => m.id === messageId);

    this.chatStore.updateMessage(currentChatId, messageId, {
      meta: {
        ...currentMessage?.meta,
        status: 'cancelled' as const,
        isStreaming: false,
        streamingProgress: 100,
        endTime: Date.now(),
        cancelReason: reason || 'user_cancelled',
        retryCount: currentMessage?.meta.retryCount || 0,
        maxRetries: currentMessage?.meta.maxRetries || 3,
        canRetry: true,
        canEdit: false,
        canDelete: true
      },
      showStatus: false,
      statusType: undefined,
      statusMessage: undefined
    });

    // 重置构建器
    this.clearMessageBuilder();
  };
}

// 创建全局实例
export const messageHandler = new MessageHandler();
