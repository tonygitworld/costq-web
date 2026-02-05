// Chat store - Zustand store for chat state management
import { create } from 'zustand';
import { type ChatSession, type Message } from '../types/chat';
import i18n from '../i18n';
import { getChatSessions, getChatMessages, deleteChatSession, convertBackendSession, convertBackendMessage } from '../services/chatApi';
import { logger } from '../utils/logger';

interface ChatState {
  // 聊天会话
  chats: Record<string, ChatSession>;
  currentChatId: string | null;

  // 消息管理
  messages: Record<string, Message[]>;

  // 加载状态
  isLoadingChats: boolean;
  isLoadingMessages: boolean; // ✅ 新增：消息加载状态

  // 操作方法
  createNewChat: () => string;  // ✅ 改为同步，只创建前端临时状态
  switchToChat: (chatId: string) => Promise<void>;  // ✅ 改为异步
  addMessage: (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  deleteChat: (chatId: string) => Promise<void>;  // ✅ 改为异步
  deleteChats: (chatIds: string[]) => Promise<void>;  // ✅ 改为异步
  clearAllChats: () => Promise<void>;  // ✅ 改为异步
  togglePinChat: (chatId: string) => void; // ✅ 新增：切换固定状态
  renameChat: (chatId: string, newTitle: string) => Promise<void>; // ✅ 异步重命名会话（支持后端同步）

  // 持久化
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => void;
}

// ✅ 生成临时ID（向后兼容，用于历史会话或错误处理）
const generateTempId = () => 'temp_' + Date.now().toString(36) + Math.random().toString(36).slice(2);

export const useChatStore = create<ChatState>((set, get) => ({
  chats: {},
  currentChatId: null,
  messages: {},
  isLoadingChats: false,
  isLoadingMessages: false, // ✅ 初始化

  createNewChat: () => {
    // ✅ 重构：只创建前端临时状态，不调用后端 API
    // ✅ 使用浏览器原生 crypto.randomUUID() 生成标准UUID
    const chatId = crypto.randomUUID();
    const title = i18n.t('chat:history.newChat', { defaultValue: '新对话' });

    // ✅ 创建临时会话对象（不保存到 localStorage，不显示在左侧列表）
    const newChat: ChatSession = {
      id: chatId,
      title: title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set(state => ({
      chats: { ...state.chats, [chatId]: newChat },
      currentChatId: chatId,
      messages: { ...state.messages, [chatId]: [] }
    }));

    logger.debug(`🆕 [createNewChat] 创建临时会话: ${chatId}（未调用后端，等待用户发送第一条消息）`);

    // ✅ 不保存到 localStorage（因为还没有消息，不应该显示在历史列表）
    // ✅ 不调用后端 API（等待用户发送第一条消息时再创建）

    return chatId;  // ✅ 返回真实UUID
  },

  switchToChat: async (chatId: string) => {
    logger.debug(`🔄 切换到会话: ${chatId}`);

    // ✅ 跳过临时会话ID的后端加载（等待后端返回真实UUID）
    const isTemporaryId = chatId.startsWith('temp_');
    if (isTemporaryId) {
      logger.debug(`⏳ 临时会话ID，等待后端返回真实UUID: ${chatId}`);
      set({ currentChatId: chatId });
      return;
    }

    // ✅ 预检查：是否需要加载消息
    const state = get();
    const messages = state.messages[chatId];
    const session = state.chats[chatId];
    const shouldReload = !messages || messages.length === 0 ||
                         (session && session.messageCount && messages.length < session.messageCount);

    // ✅ 立即更新状态
    set({
      currentChatId: chatId,
      isLoadingMessages: shouldReload
    });

    // ✅ 异步加载消息（不阻塞 UI，在后台进行）
    (async () => {
      try {
        if (shouldReload) {
          logger.debug(`📡 从后端加载会话消息: ${chatId}`);
          const backendMessages = await getChatMessages(chatId, 100);
          const convertedMessages = backendMessages.map(msg => convertBackendMessage(msg, chatId));

          // ✅ 检查切换后 currentChatId 是否仍然是 chatId（用户可能已经切换到其他会话）
          const currentState = get();
          if (currentState.currentChatId === chatId) {
            set(state => ({
              messages: {
                ...state.messages,
                [chatId]: convertedMessages
              },
              isLoadingMessages: false // ✅ 加载完成
            }));

            logger.debug(`✅ 加载了 ${convertedMessages.length} 条消息`);

            // ✅ 保存到localStorage
            get().saveToStorage();
          } else {
            logger.debug(`⚠️ 会话已切换，取消加载消息: ${chatId} → ${currentState.currentChatId}`);
          }
        } else {
          logger.debug(`ℹ️  使用缓存的消息 (${messages.length}条)`);
          // 即使不需要加载，也要确保状态重置（虽然上面已经设为 false/shouldReload）
          set({ isLoadingMessages: false });
        }
      } catch (error) {
        logger.error(`❌ 加载消息失败:`, error);
        set({ isLoadingMessages: false });
      }
    })();
  },

  addMessage: (chatId: string, messageData) => {
    const defaultMeta = {
      status: 'pending' as const,
      isStreaming: false,
      streamingProgress: 0,
      retryCount: 0,
      maxRetries: 3,
      canRetry: true,
      canEdit: messageData.type === 'user',
      canDelete: true
    };

    const messageWithDefaults = messageData as Partial<Message>;
    const message: Message = {
      ...messageData,
      id: messageWithDefaults.id || generateTempId(),  // ✅ 使用临时ID
      timestamp: messageWithDefaults.timestamp || Date.now(),
      meta: {
        ...defaultMeta,
        ...messageData.meta
      }
    };

    set(state => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] || []), message]
      }
    }));

    // 更新会话的最后更新时间和标题
    const chat = get().chats[chatId];

    // 如果是第一条用户消息且标题是默认标题，则自动生成标题
    const defaultTitle = i18n.t('chat:history.newChat', { defaultValue: '新对话' });
    let newTitle = chat?.title || defaultTitle;
    if (messageData.type === 'user' && chat?.title === defaultTitle) {
      // 从消息内容生成标题（取前20个字符）
      newTitle = messageData.content.slice(0, 20) + (messageData.content.length > 20 ? '...' : '');
    }

    // 只有在不是分析消息时才更新预览（使用多语言关键词判断）
    const analyzingKeywords = ['正在分析', '🤔', 'Analyzing', 'analyzing', '分析中'];
    const shouldUpdatePreview = !analyzingKeywords.some(keyword => messageData.content.includes(keyword));

    set(state => ({
      chats: {
        ...state.chats,
        [chatId]: {
          ...state.chats[chatId],
          title: newTitle,
          updatedAt: Date.now(),
          preview: shouldUpdatePreview
            ? messageData.content.slice(0, 50) + (messageData.content.length > 50 ? '...' : '')
            : state.chats[chatId]?.preview || ''
        }
      }
    }));

    get().saveToStorage();
  },

  updateMessage: (chatId: string, messageId: string, updates) => {
    set(state => ({
      messages: {
        ...state.messages,
        [chatId]: state.messages[chatId]?.map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        ) || []
      }
    }));

    get().saveToStorage();
  },

  deleteChat: async (chatId: string) => {
    try {
      // ✅ 调用后端API删除会话
      await deleteChatSession(chatId);
      logger.debug(`✅ 已删除会话: ${chatId}`);

      // 从前端state中删除
      set(state => {
        const { [chatId]: _, ...remainingChats } = state.chats;
        const { [chatId]: __, ...remainingMessages } = state.messages;
        void _; void __; // 显式忽略解构变量

        return {
          chats: remainingChats,
          messages: remainingMessages,
          currentChatId: state.currentChatId === chatId ? null : state.currentChatId
        };
      });
    } catch (error) {
      logger.error('❌ 删除会话失败:', error);
      throw error;
    }
  },

  deleteChats: async (chatIds: string[]) => {
    try {
      // ✅ 批量调用后端API删除会话
      await Promise.all(chatIds.map(chatId => deleteChatSession(chatId)));
      logger.debug(`✅ 已删除 ${chatIds.length} 个会话`);

      // 从前端state中删除
      set(state => {
        const remainingChats = { ...state.chats };
        const remainingMessages = { ...state.messages };
        let newCurrentChatId = state.currentChatId;

        chatIds.forEach(chatId => {
          delete remainingChats[chatId];
          delete remainingMessages[chatId];

          if (newCurrentChatId === chatId) {
            newCurrentChatId = null;
          }
        });

        return {
          chats: remainingChats,
          messages: remainingMessages,
          currentChatId: newCurrentChatId
        };
      });
    } catch (error) {
      logger.error('❌ 批量删除会话失败:', error);
      throw error;
    }
  },

  clearAllChats: async () => {
    try {
      const chatIds = Object.keys(get().chats);

      if (chatIds.length === 0) {
        logger.debug('ℹ️  没有会话需要删除');
        return;
      }

      // ✅ 批量删除所有会话
      await Promise.all(chatIds.map(chatId => deleteChatSession(chatId)));
      logger.debug(`✅ 已清空所有 ${chatIds.length} 个会话`);

      // 清除本地固定状态
      localStorage.removeItem('costq_pinned_chats');

      set({
        chats: {},
        messages: {},
        currentChatId: null
      });
    } catch (error) {
      logger.error('❌ 清空所有会话失败:', error);
      throw error;
    }
  },

  // ✅ 实现会话固定功能 (纯前端持久化)
  togglePinChat: (chatId: string) => {
    set(state => {
      const chat = state.chats[chatId];
      if (!chat) return state;

      const newIsPinned = !chat.isPinned;

      // 1. 更新 State
      const newChats = {
        ...state.chats,
        [chatId]: {
          ...chat,
          isPinned: newIsPinned,
        },
      };

      // 2. 更新 LocalStorage (独立存储，不受后端影响)
      try {
        const pinnedIds = JSON.parse(localStorage.getItem('costq_pinned_chats') || '[]');
        const newPinnedIds = newIsPinned
          ? [...pinnedIds, chatId]
          : pinnedIds.filter((id: string) => id !== chatId);
        localStorage.setItem('costq_pinned_chats', JSON.stringify(newPinnedIds));
      } catch (e) {
        console.error('Failed to save pinned chats', e);
      }

      return { chats: newChats };
    });
  },

  // ✅ 实现会话重命名（支持后端同步）
  renameChat: async (chatId: string, newTitle: string) => {
    const originalTitle = get().chats[chatId]?.title;

    // 1. 乐观更新 - 立即更新UI
    set(state => ({
      chats: {
        ...state.chats,
        [chatId]: {
          ...state.chats[chatId],
          title: newTitle,
          updatedAt: Date.now()
        }
      }
    }));

    logger.debug(`📝 重命名会话 ${chatId}: "${originalTitle}" -> "${newTitle}"`);

    // 2. 调用后端 API 同步标题
    try {
      const { updateChatSession } = await import('../services/chatApi');
      await updateChatSession(chatId, newTitle);
      logger.debug(`✅ 后端同步成功: ${chatId}`);
    } catch (error) {
      logger.error('❌ 重命名会话失败，回滚到原标题:', error);

      // 3. 失败回滚 - 恢复原标题
      set(state => ({
        chats: {
          ...state.chats,
          [chatId]: {
            ...state.chats[chatId],
            title: originalTitle || '新对话'
          }
        }
      }));

      // 重新抛出错误，让调用方处理（显示错误提示）
      throw error;
    }
  },

  loadFromStorage: async () => {
    // ✅ 去重：如果正在加载，直接返回
    const state = get();
    if (state.isLoadingChats) {
      logger.debug('⏳ 聊天历史正在加载中，跳过重复调用');
      return;
    }

    logger.debug('🔄 开始加载聊天历史...');
    set({ isLoadingChats: true });

    try {
      // ✅ 从后端API加载聊天会话列表（函数已在文件顶部导入）
      logger.debug('📡 调用 getChatSessions API...');
      const backendSessions = await getChatSessions(50);
      logger.debug(`📡 收到 ${backendSessions?.length || 0} 个会话`);

      if (!backendSessions || backendSessions.length === 0) {
        logger.debug('ℹ️  没有聊天记录，初始化为空');
        // 没有聊天记录，初始化为空
        set({
          chats: {},
          messages: {},
          currentChatId: null
        });
        return;
      }

      // 转换后端会话为前端格式
      const chats: Record<string, ChatSession> = {};
      const messages: Record<string, Message[]> = {};

      // ✅ 读取本地固定状态
      let pinnedIds: string[] = [];
      try {
        pinnedIds = JSON.parse(localStorage.getItem('costq_pinned_chats') || '[]');
      } catch (e) {
        console.error('Failed to load pinned chats', e);
      }

      // ✅ 优化：只加载会话元数据，不预加载消息内容
      // 消息内容将在用户点击会话时通过 switchToChat 懒加载
      for (const backendSession of backendSessions) {
        // 转换会话
        const session = convertBackendSession(backendSession);

        // ✅ 合并固定状态
        if (pinnedIds.includes(session.id)) {
          session.isPinned = true;
        }

        chats[session.id] = session;
        logger.debug(`📝 加载会话: ${session.title} (${session.id})`);

        // ✅ 不预加载消息，初始化为空数组
        // 消息将在用户点击会话时通过 switchToChat 懒加载
        messages[session.id] = [];
      }

      set(state => ({
        chats,
        messages,
        currentChatId: state.currentChatId // ✅ 保持当前会话 ID，不重置为 null
      }));

      logger.debug(`✅ 从后端加载了 ${Object.keys(chats).length} 个聊天会话，保持当前会话: ${get().currentChatId}`);
    } catch (error) {
      logger.error('❌ Failed to load chat data from backend:', error);
      // 回退到空状态
      set({
        chats: {},
        messages: {},
        currentChatId: null,
        isLoadingChats: false
      });
    } finally {
      set({ isLoadingChats: false });
    }
  },

  saveToStorage: () => {
    // ✅ 聊天记录现在保存在后端数据库，不再使用 localStorage
    // 此函数保留为空，避免破坏现有调用
    logger.debug('💾 聊天记录已保存到后端数据库');
  }
}));
