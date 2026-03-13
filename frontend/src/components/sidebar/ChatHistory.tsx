// ChatHistory component - Chat history list
import { type FC, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Flex, Typography, Empty, Button, Checkbox, Space, App, message, Dropdown, Input } from 'antd';
import { DeleteOutlined, CheckSquareOutlined, CloseSquareOutlined, MoreOutlined, EditOutlined, PushpinOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/chatStore';
import { useI18n } from '../../hooks/useI18n';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { logger } from '../../utils/logger';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const ChatHistory: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { modal } = App.useApp();
  const { chats, currentChatId, switchToChat, loadFromStorage, deleteChat, deleteChats, clearAllChats, messages, togglePinChat, renameChat } = useChatStore();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const { t } = useI18n(['chat', 'common']);

  // ... (保留 loadChats useEffect)

  // 处理重命名开始
  const handleStartRename = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditTitle(currentTitle);
  };

  // 处理重命名提交（异步）
  const handleSubmitRename = async () => {
    const trimmedTitle = editTitle.trim();

    // 空标题或未更改，取消编辑
    if (!editingChatId || !trimmedTitle) {
      setEditingChatId(null);
      setEditTitle('');
      return;
    }

    const originalTitle = chats[editingChatId]?.title;

    // 标题未改变，直接退出
    if (trimmedTitle === originalTitle) {
      setEditingChatId(null);
      setEditTitle('');
      return;
    }

    try {
      // ✅ 调用异步 renameChat（乐观更新 + 后端同步）
      await renameChat(editingChatId, trimmedTitle);
      setEditingChatId(null);
      setEditTitle('');
      message.success(t('history.renameSuccess') || '重命名成功');
    } catch (error) {
      logger.error('❌ 重命名失败:', error);
      message.error(t('history.renameFailed') || '重命名失败，请重试');
      // 注意：标题已在 chatStore 中自动回滚
    }
  };

  useEffect(() => {
    const loadChats = async () => {
      // ✅ 优化：如果已经有会话数据，不再重新加载，避免闪烁和状态干扰
      if (Object.keys(chats).length > 0) {
        logger.debug('ℹ️ ChatHistory: 聊天历史已存在，跳过初始化加载');
        return;
      }

      try {
        await loadFromStorage();
        logger.debug('✅ ChatHistory: 聊天历史加载完成');
      } catch (error) {
        logger.error('❌ ChatHistory: 加载聊天历史失败', error);
      }
    };
    loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chatList = Object.values(chats)
    .filter(chat => {
      const chatMessages = messages[chat.id] || [];
      if (chat.messageCount !== undefined) return true;
      return chatMessages.length > 0;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });

  const handleDeleteSingle = (chatId: string, e: any) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    } else if (e && e.domEvent && typeof e.domEvent.stopPropagation === 'function') {
      e.domEvent.stopPropagation();
    }

    logger.debug('handleDeleteSingle called for chatId:', chatId);
    modal.confirm({
      title: 'Delete chat',
      icon: null,
      content: t('history.confirmDeleteDesc'),
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      className: 'claude-modal',
      centered: true,
      width: 384,
      onOk: async () => {
        try {
          await deleteChat(chatId);
        } catch (error) {
          logger.error('❌ Failed to delete chat:', error);
          message.error(t('history.deleteFailed'));
        }
      }
    });
  };

  const handleDeleteSelected = () => {
    if (selectedChats.length === 0) return;
    modal.confirm({
      title: t('history.confirmDeleteSelected'),
      content: t('history.confirmDeleteSelectedDesc', { count: selectedChats.length }),
      okText: t('common:button.delete'),
      okType: 'danger',
      cancelText: t('common:button.cancel'),
      onOk: async () => {
        try {
          await deleteChats(selectedChats);
          setSelectedChats([]);
          setIsSelectionMode(false);
        } catch (error) {
          message.error(t('history.deleteFailed'));
        }
      }
    });
  };

  const handleClearAll = () => {
    modal.confirm({
      title: t('history.confirmClearAll'),
      content: t('history.confirmClearAllDesc'),
      okText: t('common:button.confirm'),
      okType: 'danger',
      cancelText: t('common:button.cancel'),
      onOk: async () => {
        try {
          await clearAllChats();
          setSelectedChats([]);
          setIsSelectionMode(false);
        } catch (error) {
          message.error(t('history.deleteFailed'));
        }
      }
    });
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedChats([]);
  };

  const toggleChatSelection = (chatId: string) => {
    setSelectedChats(prev =>
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

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
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelectionMode();
                }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
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
              onClick={(e) => {
                e.stopPropagation();
                toggleSelectionMode();
              }}
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

      {isSelectionMode && (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          padding: '10px 12px',
          borderRadius: '6px',
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }} onClick={(e) => e.stopPropagation()}>
          <Space size={8}>
            <Checkbox
              checked={selectedChats.length === chatList.length}
              indeterminate={selectedChats.length > 0 && selectedChats.length < chatList.length}
              onChange={(e) => {
                e.stopPropagation?.();
                toggleSelectAll();
              }}
              onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteSelected();
            }}
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

      <Flex vertical gap={4}>
        {chatList.map((chat) => {
          const isActive = currentChatId === chat.id;
          const isSelected = selectedChats.includes(chat.id);

          return (
            <div
              key={chat.id}
              className={`chat-history-item ${isActive ? 'chat-history-item-active' : ''} ${isSelected ? 'chat-history-item-selected' : ''}`}
              onClick={(e) => {
                const isChatPath = location.pathname === '/' || location.pathname.startsWith('/c/');

                // ✅ 关键修复：只有在聊天页面且是当前会话时才跳过（防抖）
                // 在设置页面等非聊天页面时，即使点击当前会话也应该导航回去
                if (isActive && isChatPath) return;

                if (isSelectionMode) {
                  toggleChatSelection(chat.id);
                } else {
                  // ✅ 修复：如果在设置页面等非聊天页面，先导航到聊天页面
                  if (!isChatPath) {
                    navigate('/');
                  }
                  switchToChat(chat.id);
                }
              }}
            >
              <div style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
                paddingRight: '24px'
              }}>
                {isSelectionMode && (
                  <Checkbox
                    checked={isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleChatSelection(chat.id)}
                  />
                )}

                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div
                    className="chat-history-item-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!isSelectionMode && editingChatId !== chat.id) {
                        handleStartRename(chat.id, chat.title);
                      }
                    }}
                    onClick={e => {
                      // 如果正在编辑，阻止点击事件冒泡
                      if (editingChatId === chat.id) {
                        e.stopPropagation();
                      }
                    }}
                    style={{
                      cursor: editingChatId === chat.id ? 'text' : 'pointer'
                    }}
                  >
                    {editingChatId === chat.id ? (
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onPressEnter={handleSubmitRename}
                        onBlur={handleSubmitRename}
                        autoFocus
                        size="small"
                        maxLength={100}
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '2px solid #1890ff',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingChatId(null);
                            setEditTitle('');
                          }
                          e.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      chat.title
                    )}
                  </div>
                  <div className="chat-history-item-time" style={{
                    fontSize: '11px',
                    color: isActive ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)',
                  }}>
                    {dayjs(chat.updatedAt).format('YYYY-MM-DD')}
                  </div>
                </div>
              </div>

              {chat.isPinned && (
                <div className="pin-icon-wrapper" style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  transition: 'opacity 0.2s',
                  opacity: 1,
                  pointerEvents: 'none'
                }}>
                  <PushpinOutlined style={{ transform: 'rotate(-45deg)', fontSize: '14px', color: 'rgb(68, 71, 70)' }} />
                </div>
              )}

              {!isSelectionMode && (
                <div
                  className={`trailing-group ${chat.isPinned ? 'pinned' : ''}`}
                  onClick={(e) => {
                    // ✅ 关键修复：完全阻止事件冒泡到父级 chat-history-item
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  style={{
                    position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  zIndex: 2
                }}>
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'pin',
                          label: chat.isPinned ? t('history.unpin') : t('history.pin'),
                          icon: <PushpinOutlined style={{ fontSize: '18px', transform: chat.isPinned ? 'rotate(-45deg)' : 'none' }} />,
                          className: 'gemini-menu-item',
                          onClick: (e) => {
                            e.domEvent.stopPropagation();
                            togglePinChat(chat.id);
                          }
                        },
                        {
                          key: 'rename',
                          label: t('history.rename'),
                          icon: <EditOutlined style={{ fontSize: '18px' }} />,
                          className: 'gemini-menu-item',
                          onClick: (e) => {
                            e.domEvent.stopPropagation();
                            handleStartRename(chat.id, chat.title);
                          }
                        },
                        {
                          key: 'delete',
                          label: t('common:button.delete'),
                          icon: <DeleteOutlined style={{ fontSize: '18px' }} />,
                          danger: true,
                          className: 'gemini-menu-item',
                          onClick: (e) => handleDeleteSingle(chat.id, e as any),
                        },
                      ],
                      className: 'gemini-dropdown-menu'
                    }}
                    trigger={['click']}
                    placement="bottomLeft"
                  >
                    <div
                      className="trailing action-button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        color: 'rgb(115, 114, 108)',
                        cursor: 'pointer',
                        fontSize: '20px',
                        marginLeft: '4px',
                      }}
                    >
                      <MoreOutlined />
                    </div>
                  </Dropdown>
                </div>
              )}
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
