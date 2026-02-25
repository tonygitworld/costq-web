// Chat-related type definitions

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  preview?: string;
  messageCount?: number;  // ✅ 新增：消息数量（用于判断是否需要重新加载）
  isPinned?: boolean; // ✅ 新增：会话固定/置顶状态
}

// Token 使用统计
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  input_cache_hit_rate: number;   // 百分比（0-100）
  output_cache_hit_rate: number;  // 百分比（0-100）
}

// 图片附件类型
export interface ImageAttachment {
  id: string;              // crypto.randomUUID()
  fileName: string;        // 原始文件名
  fileSize: number;        // 文件大小（字节）
  mimeType: string;        // MIME 类型：image/jpeg | image/png | image/gif | image/webp
  previewUrl: string;      // URL.createObjectURL() 生成的本地预览 URL
  base64Data: string;      // Base64 编码数据（含 data URI 前缀）
}

// Excel 附件类型
export interface ExcelAttachment {
  id: string;              // crypto.randomUUID()
  fileName: string;        // 原始文件名
  fileSize: number;        // 文件大小（字节）
  mimeType: string;        // MIME 类型
  base64Data: string;      // Base64 编码数据（含 data URI 前缀）
}

export interface Message {
  id: string;
  chatId: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  meta: MessageMeta;

  // ✨ 新增：Agent 工作流程展示数据（可选字段，向后兼容）
  thinking?: ThinkingData;      // 思考过程数据
  toolCalls?: ToolCallData[];   // 工具调用数据

  // ✨ 新增：按时间顺序的内容块（用于正确显示文本和工具的交替顺序）
  contentBlocks?: ContentBlock[];

  // ✅ 新增：状态提示信息（无进度条）
  statusType?: 'initializing' | 'ready' | 'error';
  statusMessage?: string;
  statusEstimatedSeconds?: number;
  statusDetails?: string[];
  showStatus?: boolean;

  // ✅ 新增：Token 使用统计（流结束后显示）
  tokenUsage?: TokenUsage;

  // ✅ 新增：图片附件（可选，向后兼容）
  imageAttachments?: ImageAttachment[];

  // ✅ 新增：Excel 附件（可选，向后兼容）
  excelAttachments?: ExcelAttachment[];
}

// ===== Agent 工作流程相关类型 =====

// 思考过程数据
export interface ThinkingData {
  steps: string[];              // 思考步骤列表
  duration?: number;            // 总耗时（秒）
  startTime?: number;           // 开始时间戳
  endTime?: number;             // 结束时间戳
}

// 工具调用数据
export interface ToolCallData {
  id: string;                   // 工具调用ID
  name: string;                 // 工具名称
  description: string;          // 调用描述
  status: 'calling' | 'success' | 'error'; // 状态
  args?: Record<string, unknown>;  // 调用参数
  result?: unknown;                // 返回结果
  error?: string;               // 错误信息
  duration?: number;            // 耗时（秒）
  startTime?: number;           // 开始时间戳
  endTime?: number;             // 结束时间戳
}

export interface MessageMeta {
  status: 'pending' | 'streaming' | 'completed' | 'failed' | 'interrupted' | 'cancelled';  // ✅ 新增 'cancelled'
  isStreaming: boolean;
  streamingProgress: number;
  error?: {
    message: string;
    code?: string;
    retryable: boolean;
  };
  retryCount: number;
  maxRetries: number;
  startTime?: number;
  endTime?: number;
  tokensReceived?: number;
  canRetry: boolean;
  canEdit: boolean;
  canDelete: boolean;
  cancelReason?: string;  // ✅ 新增：取消原因
  interruptedAt?: number;  // ✅ P0：中断时间戳（页面刷新时）
}

// 用于部分更新的类型
export type MessageMetaUpdate = Partial<MessageMeta>;

// ===== 内容块类型（用于保持时间顺序）=====

export type ContentBlock = TextBlock | ToolCallBlock;

export interface TextBlock {
  type: 'text';
  content: string;
  timestamp: number;  // 文本块接收时间
}

export interface ToolCallBlock {
  type: 'tool_call';
  toolCall: ToolCallData;
  timestamp: number;  // 工具调用开始时间
}
