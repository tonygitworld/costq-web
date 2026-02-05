// 调试脚本：检查消息重复
// 在浏览器控制台运行：
// import('./debug-messages').then(m => m.checkDuplicateMessages())

export function checkDuplicateMessages() {
  const chatStore = (window as any).__CHAT_STORE__;
  if (!chatStore) {
    console.error('❌ 找不到 chatStore，请确保已经初始化');
    return;
  }

  const { currentChatId, messages } = chatStore.getState();
  console.log('🔍 当前会话ID:', currentChatId);

  if (!currentChatId) {
    console.warn('⚠️ 没有当前会话');
    return;
  }

  const currentMessages = messages[currentChatId] || [];
  console.log('📊 消息总数:', currentMessages.length);

  // 检查重复的消息ID
  const idCount = new Map<string, number>();
  currentMessages.forEach((msg: any) => {
    const count = idCount.get(msg.id) || 0;
    idCount.set(msg.id, count + 1);
  });

  const duplicates = Array.from(idCount.entries()).filter(([_, count]) => count > 1);

  if (duplicates.length > 0) {
    console.error('❌ 发现重复的消息ID:');
    duplicates.forEach(([id, count]) => {
      console.error(`  - ID: ${id}, 出现次数: ${count}`);
      const msgs = currentMessages.filter((m: any) => m.id === id);
      console.table(msgs.map((m: any) => ({
        id: m.id,
        type: m.type,
        content: m.content.slice(0, 50),
        timestamp: m.timestamp
      })));
    });
  } else {
    console.log('✅ 没有重复的消息ID');
  }

  // 显示所有消息
  console.table(currentMessages.map((m: any) => ({
    id: m.id.slice(0, 20) + '...',
    type: m.type,
    content: m.content.slice(0, 50),
    isStreaming: m.meta?.isStreaming,
    status: m.meta?.status
  })));
}

// 暴露到全局作用域方便调试
(window as any).checkDuplicateMessages = checkDuplicateMessages;
