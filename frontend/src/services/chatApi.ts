/**
 * 聊天历史API服务
 *
 * 功能：
 * - 从后端加载聊天会话列表
 * - 加载单个会话的消息
 * - 创建新会话
 * - 保存消息
 * - 删除会话
 */

import { apiClient } from './apiClient';

// ============================================
// 类型定义
// ============================================

export interface ChatSession {
  id: string;
  user_id: string;
  org_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  message_count: number;
  total_tokens: number;
  model_config?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  type: 'user' | 'assistant' | 'system' | 'tool';  // API使用'type'而不是'role'
  content: string;
  timestamp: string;  // API使用'timestamp'而不是'created_at'
  token_count?: number;
  tool_calls?: ToolCallRecord[];
  tool_results?: ToolResultRecord[];
  metadata?: ChatMessageMetadata;
}

// 工具调用记录
interface ToolCallRecord {
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
  status?: 'pending' | 'running' | 'success' | 'error';
}

// 工具结果记录
interface ToolResultRecord {
  tool_call_id: string;
  result?: unknown;
  error?: string;
}

// 消息元数据
interface ChatMessageMetadata {
  token_usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
    input_cache_hit_rate?: number;
  };
  [key: string]: unknown;
}

export interface CreateSessionRequest {
  title: string;
  session_id?: string;  // ✅ 可选：前端提供的 UUID
}

export interface SaveMessageRequest {
  content: string;
  message_type: 'user' | 'assistant' | 'system' | 'tool';
  metadata?: string;
  tool_calls?: ToolCallRecord[];
  tool_results?: ToolResultRecord[];
  token_count?: number;
}

// ============================================
// API函数
// ============================================

/**
 * 获取当前用户的聊天会话列表
 */
export async function getChatSessions(limit: number = 50): Promise<ChatSession[]> {
  const response = await apiClient.get<ChatSession[]>('/chat/sessions', {
    params: { limit }
  });
  return response;
}

/**
 * 获取单个会话详情
 */
export async function getChatSession(sessionId: string): Promise<ChatSession> {
  const response = await apiClient.get<ChatSession>(`/chat/sessions/${sessionId}`);
  return response;
}

/**
 * 创建新会话
 */
export async function createChatSession(title: string, sessionId?: string): Promise<ChatSession> {
  const request: CreateSessionRequest = { title };
  if (sessionId) {
    request.session_id = sessionId;  // ✅ 传递前端生成的 UUID
  }
  const response = await apiClient.post<ChatSession>('/chat/sessions', request);
  return response;
}

/**
 * 更新会话标题
 */
export async function updateChatSession(sessionId: string, title: string): Promise<ChatSession> {
  const response = await apiClient.put<ChatSession>(`/chat/sessions/${sessionId}`, {
    title
  });
  return response;
}

/**
 * 删除会话
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/chat/sessions/${sessionId}`);
}

/**
 * 获取会话的所有消息
 */
export async function getChatMessages(sessionId: string, limit: number = 100): Promise<ChatMessage[]> {
  const response = await apiClient.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`, {
    params: { limit }
  });
  return response;
}

/**
 * 保存消息到会话
 */
export async function saveChatMessage(
  sessionId: string,
  request: SaveMessageRequest
): Promise<ChatMessage> {
  const response = await apiClient.post<ChatMessage>(
    `/chat/sessions/${sessionId}/messages`,
    request
  );
  return response;
}

/**
 * 删除消息
 */
export async function deleteChatMessage(sessionId: string, messageId: string): Promise<void> {
  await apiClient.delete(`/chat/sessions/${sessionId}/messages/${messageId}`);
}

// ============================================
// 辅助函数
// ============================================

/**
 * 将后端的ChatSession转换为前端的ChatSession格式
 */
export function convertBackendSession(backendSession: ChatSession) {
  return {
    id: backendSession.id,
    title: backendSession.title,
    createdAt: new Date(backendSession.created_at).getTime(),
    updatedAt: new Date(backendSession.updated_at).getTime(),
    preview: `${backendSession.message_count} 条消息`,
    messageCount: backendSession.message_count,
    totalTokens: backendSession.total_tokens
  };
}

/**
 * 将后端的ChatMessage转换为前端的Message格式
 */
export function convertBackendMessage(backendMessage: ChatMessage, chatId: string) {
  // ✅ 将 'tool' 类型转换为 'system'（前端不支持 'tool' 类型）
  const messageType = backendMessage.type === 'tool' ? 'system' : backendMessage.type;

  // ✅ 解析 Token 统计数据（如果存在）
  let tokenUsage = undefined;
  if (backendMessage.metadata?.token_usage) {
    const tu = backendMessage.metadata.token_usage;
    tokenUsage = {
      input_tokens: tu.input_tokens || 0,
      output_tokens: tu.output_tokens || 0,
      cache_read_tokens: tu.cache_read_tokens || 0,
      cache_write_tokens: tu.cache_write_tokens || 0,
      input_cache_hit_rate: tu.input_cache_hit_rate || 0,
      output_cache_hit_rate: 0,  // AWS Bedrock 不支持输出缓存
    };
  }

  return {
    id: backendMessage.id,
    chatId: chatId,
    type: messageType as 'user' | 'assistant' | 'system',
    content: backendMessage.content,
    timestamp: new Date(backendMessage.timestamp).getTime(),
    tokenUsage,  // ✅ 添加 Token 统计
    meta: {
      status: 'completed' as const,  // ✅ 使用 'completed' 而不是 'success'
      isStreaming: false,
      streamingProgress: 100,
      retryCount: 0,
      maxRetries: 3,
      canRetry: false,
      canEdit: backendMessage.type === 'user',
      canDelete: true
    }
    // ✅ 不再传递 toolCalls 和 toolResults（后端不保存，刷新后只显示最终结果）
    // toolCalls: backendMessage.tool_calls,
    // toolResults: backendMessage.tool_results
  };
}
