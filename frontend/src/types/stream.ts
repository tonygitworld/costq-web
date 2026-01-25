// Stream message types for agent workflow display

// 流式消息类型联合
export type StreamMessage =
  | ThinkingMessage
  | ToolCallMessage
  | ContentMessage
  | ControlMessage;

// ===== 思考过程消息 =====

export interface ThinkingStartMessage {
  type: 'thinking_start';
  timestamp: string;
}

export interface ThinkingStepMessage {
  type: 'thinking_step';
  step: number;
  content: string;
  timestamp: string;
}

export interface ThinkingEndMessage {
  type: 'thinking_end';
  duration: number; // 秒
  timestamp: string;
}

export type ThinkingMessage =
  | ThinkingStartMessage
  | ThinkingStepMessage
  | ThinkingEndMessage;

// ===== 工具调用消息 =====

export interface ToolCallStartMessage {
  type: 'tool_call_start';
  tool_id: string;
  tool_name: string;
  description: string;
  args?: Record<string, unknown>;
  timestamp: string;
}

export interface ToolCallProgressMessage {
  type: 'tool_call_progress';
  tool_id: string;
  status: string;
  timestamp: string;
}

export interface ToolCallResultMessage {
  type: 'tool_call_result';
  tool_id: string;
  result: unknown;
  duration: number; // 秒
  timestamp: string;
}

export interface ToolCallErrorMessage {
  type: 'tool_call_error';
  tool_id: string;
  error: string;
  timestamp: string;
}

export type ToolCallMessage =
  | ToolCallStartMessage
  | ToolCallProgressMessage
  | ToolCallResultMessage
  | ToolCallErrorMessage;

// ===== 内容消息 =====

export interface ContentDeltaMessage {
  type: 'content_delta';
  delta: string;
  timestamp: string;
}

export type ContentMessage = ContentDeltaMessage;

// ===== 控制消息 =====

export interface DoneMessage {
  type: 'done';
  timestamp: string;
}

export interface ErrorMessage {
  type: 'error';
  error: string;
  timestamp: string;
}

export type ControlMessage = DoneMessage | ErrorMessage;

// ===== 工具调用状态 =====

export type ToolCallStatus = 'calling' | 'success' | 'error';
