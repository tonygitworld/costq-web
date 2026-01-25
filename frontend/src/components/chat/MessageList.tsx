import { type FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo } from 'react';
import { Button, Empty, Typography, Flex } from 'antd';
import { ArrowDownOutlined } from '@ant-design/icons';
import { MessageItem } from './MessageItem';
import { useChatStore } from '../../stores/chatStore';
import { useI18n } from '../../hooks/useI18n';
import './MessageList.css';

const { Text } = Typography;

// ✅ 优化：提取阈值常量，避免魔术数字
const THRESHOLD_ADSORB = 100;       // 基础吸附阈值（离开这个范围认为用户想看历史）
const THRESHOLD_FORCE_STREAM = 150; // 流式输出时的强制吸附阈值（容忍度更高）
const THRESHOLD_NEW_MSG = 300;      // 新消息到达时的吸附阈值

// ✅ 性能优化：使用 memo 包裹消息项
const MemoizedMessageItem = memo(MessageItem);

export const MessageList: FC = () => {
  const { currentChatId, messages } = useChatStore();
  const { t } = useI18n('chat');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // ✅ 核心状态：是否自动吸附到底部
  const autoScrollEnabledRef = useRef(true);

  // 记录上一次的滚动高度，用于区分是“用户滑动”还是“内容增长”
  const lastScrollHeightRef = useRef(0);

  // ✅ 优化：用于 onScroll 节流的锁，避免高频计算
  const scrollRafRef = useRef<number | null>(null);

  // 记录上一条消息的数量
  const prevMessageCountRef = useRef(0);

  const [showScrollButton, setShowScrollButton] = useState(false);

  // 获取当前消息列表
  const currentMessages = useMemo(() => {
    if (!currentChatId) return [];
    return messages[currentChatId] || [];
  }, [currentChatId, messages]);

  // 判断是否正在流式传输
  const isStreaming = useMemo(() => {
    const lastMsg = currentMessages[currentMessages.length - 1];
    return lastMsg?.meta?.isStreaming || false;
  }, [currentMessages]);

  // ✅ 核心滚动执行函数
  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' | 'instant' = 'auto') => {
    const el = containerRef.current;
    if (!el) return;

    const targetTop = el.scrollHeight;

    // 如果已经在底部（容差内），且要求 instant，可以跳过（减少抖动）
    // 但如果是 content 增长导致的调用，必须执行
    el.scrollTo({
      top: targetTop,
      behavior: behavior === 'auto' ? 'instant' : behavior,
    });

    // 强制重置状态：一旦程序执行了滚动，就认为应该继续吸附
    autoScrollEnabledRef.current = true;

    // 更新基准值，防止 onScroll 误判
    lastScrollHeightRef.current = el.scrollHeight;

    setShowScrollButton(false);
  }, []);

  // ✅ 滚动监听：只负责检测“用户是否主动离开了底部”
  const handleScroll = useCallback(() => {
    // ✅ 优化：rAF 节流 (Throttling)
    // 如果这一帧已经在计算了，就跳过，防止高频触发挤占主线程
    if (scrollRafRef.current) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) {
        // 如果是程序刚刚触发的滚动导致的高度变化，忽略
        // 如果正在流式输出，且用户没有明显交互，尽量保持 True

        const { scrollTop, scrollHeight, clientHeight } = el;
        const distanceToBottom = Math.abs(scrollHeight - scrollTop - clientHeight);

        // 关键逻辑：
        // 只有当 distanceToBottom 真的很大（说明不在底部）
        // 并且 scrollHeight 没有发生突变（或者突变已经稳定）时
        // 我们才认为用户是真的想离开底部

        // 如果距离底部很近，自动吸附
        if (distanceToBottom <= THRESHOLD_ADSORB) {
          autoScrollEnabledRef.current = true;
          setShowScrollButton(false);
        }
        // 如果距离远，且不是因为内容刚刚撑开导致的
        else {
          // 修正：只要距离底部太远，就显示按钮，并暂时停止自动滚动
          // 最终方案：相信 distance。如果 distance 大，就认为不在底部。
          // 但是 ResizeObserver 会负责在“应吸附”状态下把 distance 归零。
          autoScrollEnabledRef.current = false;
          setShowScrollButton(true);
        }

        lastScrollHeightRef.current = scrollHeight;
      }

      // ✅ 关键：任务完成后解锁
      scrollRafRef.current = null;
    });
  }, []);

  // 组件卸载时清理 rAF，防止内存泄漏
  useEffect(() => {
    return () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // ✅ 场景1：内容高度变化（核心：流式输出时的跟随）
  useEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const { scrollHeight, scrollTop, clientHeight } = container;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;

      // 逻辑：
      // 1. 如果当前处于“吸附状态” (autoScrollEnabledRef.current === true) -> 必须滚到底部
      // 2. 如果当前 distanceToBottom 很小 (说明用户就在底部，只是还没滚) -> 必须滚到底部
      // 3. 强力模式：如果正在 isStreaming，且用户没有跑得太远 (比如 < 150px)，强制吸附！

      const isCloseEnough = distanceToBottom < THRESHOLD_FORCE_STREAM;

      if (autoScrollEnabledRef.current || isCloseEnough) {
        // 记录新的高度，防止 handleScroll 误判
        lastScrollHeightRef.current = container.scrollHeight;

        // 必须使用 instant，否则流式输出会抖动
        container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });

        // 确保状态正确
        autoScrollEnabledRef.current = true;
        setShowScrollButton(false);
      }
    });

    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [isStreaming]); // 依赖 isStreaming，确保流状态变化时重新评估

  // ✅ 场景2：新消息到达（用户发送 或 AI回复开始）
  useLayoutEffect(() => {
    const currentCount = currentMessages.length;
    const prevCount = prevMessageCountRef.current;

    if (currentCount > prevCount) {
      const lastMessage = currentMessages[currentCount - 1];

      // 用户发的消息：强制平滑滚动到底部
      if (lastMessage.type === 'user') {
        scrollToBottom('smooth');
      }
      // AI 发的消息（且之前我们在底部）：吸附
      else {
        // 这里稍微激进一点：只要是新消息来了，且之前没离得太远，就吸附
        const el = containerRef.current;
        if (el) {
          const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
          if (distance < THRESHOLD_NEW_MSG) { // 300px 容差
            scrollToBottom('instant');
          }
        }
      }
    }

    prevMessageCountRef.current = currentCount;
  }, [currentMessages, scrollToBottom]);

  // ✅ 场景3：切换对话 / 初始加载
  useLayoutEffect(() => {
    if (currentChatId) {
      scrollToBottom('instant');
      // 双重保险
      requestAnimationFrame(() => scrollToBottom('instant'));
    }
  }, [currentChatId, scrollToBottom]);


  // --- 渲染层 ---

  if (!currentChatId || currentMessages.length === 0) {
    return (
      <div className="message-list-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty
          description={<Text type="secondary">{currentChatId ? t('message.startChat') : t('message.emptyState')}</Text>}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className="message-list-wrapper">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="message-list-container"
        style={{ padding: '24px 32px' }}
      >
        <div ref={contentRef}>
          <Flex vertical gap={0}>
            {currentMessages.map((message) => (
              <div key={message.id} style={{ padding: '12px 0', width: '100%' }}>
                <MemoizedMessageItem message={message} />
              </div>
            ))}
            {/* 底部垫片 */}
            <div style={{ height: '60px', width: '100%', flexShrink: 0 }} />
          </Flex>
        </div>
      </div>

      <Button
        className={`scroll-to-bottom-btn ${showScrollButton ? 'visible' : ''}`}
        icon={<ArrowDownOutlined />}
        onClick={() => scrollToBottom('smooth')}
        aria-label="Scroll to bottom"
      />
    </div>
  );
};
