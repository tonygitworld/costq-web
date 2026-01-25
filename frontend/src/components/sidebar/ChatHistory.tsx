// ChatHistory component - Chat history list
import { type FC, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Flex, Typography, Empty, Button, Checkbox, Space, App, message } from 'antd';
import { DeleteOutlined, CheckSquareOutlined, CloseSquareOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/chatStore';
import { useI18n } from '../../hooks/useI18n';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const ChatHistory: FC = () => {
  // const navigate = useNavigate();
  // const location = useLocation();
  const { modal } = App.useApp();
  const { chats, currentChatId, switchToChat, loadFromStorage, deleteChat, deleteChats, clearAllChats, messages } = useChatStore();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const { t } = useI18n(['chat', 'common']);

  useEffect(() => {
    // ✅ 正确处理异步函数
    // ✅ 使用空依赖数组，只在组件挂载时调用一次
    // loadFromStorage 内部已有去重机制，避免重复调用
    const loadChats = async () => {
      try {
        await loadFromStorage();
        console.log('✅ ChatHistory: 聊天历史加载完成');
      } catch (error) {
        console.error('❌ ChatHistory: 加载聊天历史失败', error);
      }
    };

    loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ 空依赖数组，只在挂载时调用一次

  // ✅ 过滤逻辑：
  // 1. 从后端加载的会话（有 messageCount 字段）：即使消息为空也显示（消息是懒加载的）
  // 2. 前端临时创建的会话（无 messageCount 字段）：只有有消息时才显示
  const chatList = Object.values(chats)
    .filter(chat => {
      const chatMessages = messages[chat.id] || [];
      
      // ✅ 如果会话有 messageCount 字段，说明是从后端加载的，应该显示
      // （即使消息为空，因为消息是懒加载的）
      if (chat.messageCount !== undefined) {
        return true;
      }
      
      // ✅ 如果会话没有 messageCount 字段，说明是前端临时创建的
      // 只有有消息时才显示（至少有一条消息）
      return chatMessages.length > 0;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  // 处理单个删除
  const handleDeleteSingle = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('handleDeleteSingle called for chatId:', chatId);
    modal.confirm({
      title: t('history.confirmDelete'),
      content: t('history.confirmDeleteDesc'),
      okText: t('common:button.delete'),
      okType: 'danger',
      cancelText: t('common:button.cancel'),
      onOk: async () => {
        console.log('Deleting chat:', chatId);
        try {
          await deleteChat(chatId);
          console.log('✅ Chat deleted successfully');
        } catch (error) {
          console.error('❌ Failed to delete chat:', error);
          message.error(t('history.deleteFailed'));
        }
      }
    });
  };

  // 处理批量删除
  const handleDeleteSelected = () => {
    if (selectedChats.length === 0) return;

    modal.confirm({
      title: t('history.confirmDeleteSelected'),
      content: t('history.confirmDeleteSelectedDesc', { count: selectedChats.length }),
      okText: t('common:button.delete'),
      okType: 'danger',
      cancelText: t('common:button.cancel'),
      onOk: async () => {
        console.log('Deleting selected chats:', selectedChats);
        try {
          await deleteChats(selectedChats);
          console.log('✅ Selected chats deleted successfully');
          setSelectedChats([]);
          setIsSelectionMode(false);
        } catch (error) {
          console.error('❌ Failed to delete selected chats:', error);
          message.error(t('history.deleteFailed'));
        }
      }
    });
  };

  // 处理清空所有
  const handleClearAll = () => {
    console.log('handleClearAll called, chatList.length:', chatList.length);
    modal.confirm({
      title: t('history.confirmClearAll'),
      content: t('history.confirmClearAllDesc'),
      okText: t('common:button.confirm'),
      okType: 'danger',
      cancelText: t('common:button.cancel'),
      onOk: async () => {
        console.log('Clearing all chats');
        try {
          await clearAllChats();
          console.log('✅ All chats cleared successfully');
          setSelectedChats([]);
          setIsSelectionMode(false);
        } catch (error) {
          console.error('❌ Failed to clear all chats:', error);
          message.error(t('history.deleteFailed'));
        }
      }
    });
  };

  // 切换选择模式
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedChats([]);
  };

  // 切换选中状态
  const toggleChatSelection = (chatId: string) => {
    setSelectedChats(prev =>
      prev.includes(chatId)
        ? prev.filter(id => id !== chatId)
        : [...prev, chatId]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedChats.length === chatList.length) {
      setSelectedChats([]);
    } else {
      setSelectedChats(chatList.map(chat => chat.id));
    }
  };

  if (chatList.length === 0) {
    return (
      <div>
        <Text style={{
          color: 'rgba(255,255,255,0.75)',
          fontSize: '14px',
          fontWeight: 500,
          display: 'block',
          marginBottom: '16px',
          letterSpacing: '0.3px'
        }}>
          💬 {t('sidebar.chatHistory')}
        </Text>
        <Empty
          description={
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
              {t('history.noChatHistory')}
            </Text>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div>
      {/* 标题栏和操作按钮 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <Text style={{
          color: 'rgba(255,255,255,0.75)',
          fontSize: '14px',
          fontWeight: 500,
          letterSpacing: '0.3px'
        }}>
          💬 {t('sidebar.chatHistory')} ({chatList.length})
        </Text>

        <Space size={4}>
          {!isSelectionMode ? (
            <>
              <Button
                type="text"
                size="small"
                icon={<CheckSquareOutlined />}
                onClick={toggleSelectionMode}
                style={{
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: '12px',
                  padding: '0 6px',
                  height: '24px'
                }}
              />
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={handleClearAll}
                style={{
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: '12px',
                  padding: '0 6px',
                  height: '24px'
                }}
              />
            </>
          ) : (
            <Button
              type="text"
              size="small"
              icon={<CloseSquareOutlined />}
              onClick={toggleSelectionMode}
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: '12px',
                padding: '0 6px',
                height: '24px'
              }}
            />
          )}
        </Space>
      </div>

      {/* 批量操作工具栏 */}
      {isSelectionMode && (
        <div style={{
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          padding: '10px 12px',
          borderRadius: '6px',
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space size={8}>
            <Checkbox
              checked={selectedChats.length === chatList.length}
              indeterminate={selectedChats.length > 0 && selectedChats.length < chatList.length}
              onChange={toggleSelectAll}
              style={{ color: 'rgba(255,255,255,0.85)' }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}>
                全选
              </Text>
            </Checkbox>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>
              已选 {selectedChats.length} 个
            </Text>
          </Space>

          <Button
            type="primary"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={handleDeleteSelected}
            disabled={selectedChats.length === 0}
            style={{
              fontSize: '12px',
              height: '24px',
              backgroundColor: selectedChats.length === 0 ? 'rgba(255,77,79,0.3)' : '#ff4d4f',
              borderColor: selectedChats.length === 0 ? 'rgba(255,77,79,0.3)' : '#ff4d4f',
              color: selectedChats.length === 0 ? 'rgba(255,255,255,0.4)' : '#ffffff'
            }}
          >
            删除
          </Button>
        </div>
      )}

      {/* 对话列表 - 使用 Flex 替代已废弃的 List 组件 */}
      <Flex vertical gap={4}>
        {chatList.map((chat) => {
          const isActive = currentChatId === chat.id;
          const isSelected = selectedChats.includes(chat.id);

          return (
            <div
              key={chat.id}
              style={{
                padding: '10px 12px', // 进一步缩小内边距，参考 ChatGPT/Claude 标准
                marginBottom: '4px',  // 更加紧凑
                cursor: 'pointer',
                borderRadius: '8px',
                backgroundColor: isActive
                  ? 'rgba(102, 126, 234, 0.15)'
                  : isSelected
                  ? 'rgba(102, 126, 234, 0.08)'
                  : 'transparent',
                borderLeft: isActive
                  ? '3px solid #667eea'
                  : '3px solid transparent',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isActive ? '0 2px 8px rgba(102, 126, 234, 0.15)' : 'none'
              }}
              onClick={() => {
                if (isSelectionMode) {
                  toggleChatSelection(chat.id);
                } else {
                  // ✅ 只调用 switchToChat，让 ChatLayout 的 URL 同步逻辑自动更新 URL
                  // ✅ 这样可以避免手动 navigate 和自动同步逻辑的冲突
                  switchToChat(chat.id);  // ✅ 不等待，立即返回
                  // ✅ URL 更新由 ChatLayout 的 Store → URL 同步逻辑自动处理
                  // ✅ 消息加载在 switchToChat 内部异步进行，不阻塞 UI
                }
              }}
              onMouseEnter={(e) => {
                if (!isActive && !isSelected) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.transform = 'translateX(2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive && !isSelected) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.transform = 'translateX(0)';
                }
              }}
            >
              <div style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                minWidth: 0 /* ✅ 确保 flex 子元素可以收缩，防止溢出 */
              }}>
                {/* 选择框 */}
                {isSelectionMode && (
                  <Checkbox
                    checked={isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleChatSelection(chat.id)}
                    style={{ marginTop: '2px' }}
                  />
                )}

                {/* 对话信息 */}
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{
                    color: isActive ? '#ffffff' : 'rgba(255,255,255,0.85)',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    marginBottom: '2px', // 缩小标题和时间的间距
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%'
                  }}>
                    {chat.title}
                  </div>
                  {/* 移除预览内容和消息数量显示，保持界面简洁 */}
                  <div style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '11px'
                  }}>
                    {dayjs(chat.updatedAt).fromNow()}
                  </div>
                </div>

                {/* 单个删除按钮 */}
                {!isSelectionMode && (
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => handleDeleteSingle(chat.id, e)}
                    style={{
                      opacity: 0.7,
                      transition: 'opacity 0.2s',
                      fontSize: '12px',
                      padding: '0 4px',
                      height: '20px',
                      color: '#ff4d4f'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.7';
                    }}
                    className="delete-button"
                  />
                )}
              </div>
            </div>
          );
        })}
      </Flex>

      <style>{`
        /* 删除按钮悬停显示 - 适配 Flex 布局 */
        .delete-button:hover {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};
