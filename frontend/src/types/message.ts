// Message type definitions (used by both SSE and WebSocket)

export interface WebSocketMessage {
  type:
    // 旧格式（向后兼容）
    | 'stream_start' | 'stream_chunk' | 'stream_end' | 'response' | 'completion' | 'thinking'
    // ✅ 兼容后端别名
    | 'chunk' | 'complete' | 'message_start'
    // 新格式（Agent 工作流程）
    | 'thinking_start' | 'thinking_step' | 'thinking_end'
    | 'tool_call_start' | 'tool_call_progress' | 'tool_call_result' | 'tool_call_error'
    | 'content_delta' | 'message_complete' | 'error'
    // AWS API 确认（新增）
    | 'confirmation_required' | 'confirmation_approved' | 'confirmation_rejected' | 'confirmation_timeout'
    // ✅ 新增: 取消相关消息
    | 'generation_cancelled' | 'cancellation_acknowledged'
    // ✅ 新增: 状态提示消息（无进度条）
    | 'status'
    // ✅ 新增: 后端创建Session后返回session_id
    | 'session_created'
    // ✅ P2修复：Session续期事件
    | 'session_renewed'
    // 批处理消息（性能优化）
    | 'batch'
    // ✅ 新增: 心跳消息
    | 'ping' | 'pong'
    // ✅ 新增: 系统消息
    | 'system'
    // ✅ 新增: Token 使用统计
    | 'token_usage'
    // ✅ 新增: 系统消息
    | 'system';
  timestamp: number | string;
  query_id?: string;  // ✅ 新增: 查询ID（可选，用于追踪）
  [key: string]: unknown;
}

// 批处理消息类型
export interface BatchMessage extends WebSocketMessage {
  type: 'batch';
  messages: WebSocketMessage[];
  count: number;
}

export interface StreamChunkMessage extends WebSocketMessage {
  type: 'stream_chunk';
  content: string;
  is_final: boolean;
}

export interface CompletionMessage extends WebSocketMessage {
  type: 'completion';
  success: boolean;
  error?: string;
  total_time: number;
}

// AWS API 确认消息类型
export interface ConfirmationRequiredMessage extends WebSocketMessage {
  type: 'confirmation_required';
  confirmation_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  title: string;
  description: string;
  warning: string;
  risk_level: 'low' | 'medium' | 'high';
  timeout_seconds: number;
}

export interface ConfirmationResponseMessage {
  type: 'confirmation_response';
  confirmation_id: string;
  approved: boolean;
}

// ✅ 新增: 查询消息类型
export interface QueryMessage {
  type: 'query';
  query_id: string;
  content: string;
  account_ids?: string[];
  gcp_account_ids?: string[];
  session_id?: string;  // ✅ 新增：会话ID，用于多轮对话
  timestamp: number;
}

// ✅ 新增: 取消生成消息类型
export interface CancelGenerationMessage {
  type: 'cancel_generation';
  query_id: string;
  timestamp: number;
}

// ✅ 新增: 生成已取消消息类型
export interface GenerationCancelledMessage extends WebSocketMessage {
  type: 'generation_cancelled';
  query_id: string;
  reason: string;
}

// ✅ 新增: 取消确认消息类型
export interface CancellationAcknowledgedMessage extends WebSocketMessage {
  type: 'cancellation_acknowledged';
  query_id: string;
}

// ✅ 新增: 状态提示消息类型（无进度条）
export interface StatusMessage extends WebSocketMessage {
  type: 'status';
  status_type: 'initializing' | 'processing' | 'ready' | 'error';
  message: string;
  estimated_seconds?: number;
  details?: string[];
}

// ✅ 新增: Token 使用统计消息类型
export interface TokenUsageMessage extends WebSocketMessage {
  type: 'token_usage';
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    input_cache_hit_rate: number;   // 百分比（0-100）
    output_cache_hit_rate: number;  // 百分比（0-100）
  };
}
