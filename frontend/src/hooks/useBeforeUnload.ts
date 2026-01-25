/**
 * 页面刷新/关闭前保存流式生成内容
 *
 * 用途：防止用户刷新页面时丢失正在生成的内容
 */

import { useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSSEContext } from '../contexts/SSEContext';

export const useBeforeUnload = () => {
  const { messages, currentChatId } = useChatStore();
  const { currentQueryId } = useSSEContext();

  useEffect(() => {
    const handleBeforeUnload = () => {
      // 1. 检查是否有正在生成的消息
      if (!currentChatId) return;

      const currentMessages = messages[currentChatId] || [];
      const streamingMessage = currentMessages.find(
        msg => msg.meta?.isStreaming === true
      );

      if (streamingMessage) {
        // 2. 保存中断状态到 localStorage
        const interruptedState = {
          chatId: currentChatId,
          messageId: streamingMessage.id,
          content: streamingMessage.content,
          timestamp: Date.now(),
          queryId: currentQueryId
        };

        try {
          localStorage.setItem('interrupted_message', JSON.stringify(interruptedState));
          console.log('💾 已保存流式中断内容:', interruptedState);
        } catch (error) {
          console.error('❌ 保存中断状态失败:', error);
        }

        // 3. 尽力发送停止生成请求（使用 sendBeacon 确保发送）
        if (currentQueryId) {
          try {
            // ✅ 使用 v2 取消接口
            const cancelUrl = `${window.location.origin}/api/sse/cancel/v2/${currentQueryId}`;
            const cancelData = JSON.stringify({ reason: 'page_refresh' });
            navigator.sendBeacon(cancelUrl, cancelData);
            console.log('📡 已发送取消请求 (sendBeacon) - V2');
          } catch (error) {
            console.error('⚠️  发送取消请求失败:', error);
          }
        }
      }
    };

    // 注册事件监听
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentChatId, messages, currentQueryId]);

  // 页面加载时恢复中断的消息
  useEffect(() => {
    try {
      const interruptedStateStr = localStorage.getItem('interrupted_message');
      if (!interruptedStateStr) return;

      const state = JSON.parse(interruptedStateStr);

      // 检查是否是最近 5 分钟内的中断
      const age = Date.now() - state.timestamp;
      const MAX_AGE = 5 * 60 * 1000; // 5分钟

      if (age > MAX_AGE) {
        console.log('⏰ 中断状态已过期，忽略');
        localStorage.removeItem('interrupted_message');
        return;
      }

      // 恢复中断的消息
      console.log('🔄 恢复中断的消息:', state);

      const currentMessages = messages[state.chatId] || [];
      const existingMessage = currentMessages.find(msg => msg.id === state.messageId);

      if (existingMessage) {
        // 更新现有消息
        useChatStore.getState().updateMessage(state.chatId, state.messageId, {
          content: state.content + '\n\n_[生成因页面刷新中断]_',
          meta: {
            ...existingMessage.meta,
            status: 'interrupted',
            isStreaming: false,
            interruptedAt: state.timestamp
          }
        });
        console.log('✅ 已恢复中断消息');
      }

      // 清理 localStorage
      localStorage.removeItem('interrupted_message');
    } catch (error) {
      console.error('❌ 恢复中断状态失败:', error);
      localStorage.removeItem('interrupted_message');
    }
  }, []); // 只在组件挂载时执行一次
};
