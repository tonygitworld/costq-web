// TestDataButton - Development tool for testing agent workflow display
// Only shown in development mode

import { type FC, useState } from 'react';
import { Button, Dropdown, Space, message as antMessage } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import { useChatStore } from '../../stores/chatStore';
import {
  createTestMessageWithWorkflow,
  createTestMessageWithMultipleTools,
  createTestMessageWithError,
  createTestMessageOldFormat
} from '../../utils/testData';

export const TestDataButton: FC = () => {
  const { currentChatId, addMessage } = useChatStore();
  const [loading, setLoading] = useState(false);

  // 只在开发模式下显示
  if (import.meta.env.PROD) {
    return null;
  }

  const injectTestMessage = (type: 'workflow' | 'multi' | 'error' | 'old') => {
    if (!currentChatId) {
      antMessage.error('请先创建或选择一个对话');
      return;
    }

    setLoading(true);

    // 模拟延迟，让用户看到加载状态
    setTimeout(() => {
      let testMessage;
      let messageType = '';

      switch (type) {
        case 'workflow':
          testMessage = createTestMessageWithWorkflow(currentChatId);
          messageType = '完整工作流程';
          break;
        case 'multi':
          testMessage = createTestMessageWithMultipleTools(currentChatId);
          messageType = '多工具调用';
          break;
        case 'error':
          testMessage = createTestMessageWithError(currentChatId);
          messageType = '错误情况';
          break;
        case 'old':
          testMessage = createTestMessageOldFormat(currentChatId);
          messageType = '旧格式（向后兼容）';
          break;
      }

      if (testMessage) {
        addMessage(currentChatId, testMessage);
        antMessage.success(`已注入测试消息：${messageType}`);
      }

      setLoading(false);
    }, 300);
  };

  const menuItems = [
    {
      key: 'workflow',
      label: '✨ 完整工作流程',
      onClick: () => injectTestMessage('workflow')
    },
    {
      key: 'multi',
      label: '🔧 多工具调用',
      onClick: () => injectTestMessage('multi')
    },
    {
      key: 'error',
      label: '❌ 错误情况',
      onClick: () => injectTestMessage('error')
    },
    {
      key: 'old',
      label: '📄 旧格式（兼容性）',
      onClick: () => injectTestMessage('old')
    }
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="topRight"
      trigger={['click']}
    >
      <Button
        type="dashed"
        icon={<BugOutlined />}
        loading={loading}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '24px',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          borderColor: '#ff4d4f',
          color: '#ff4d4f'
        }}
      >
        <Space>
          测试数据
        </Space>
      </Button>
    </Dropdown>
  );
};
