/**
 * 欢迎页面快速测试组件
 * 用于验证 CenterWelcome 组件是否正常工作
 *
 * 使用方法：
 * 1. 临时导入到 App.tsx 或任何页面
 * 2. 渲染此组件查看效果
 */

import { type FC, useState } from 'react';
import { CenterWelcomeNoAccount } from './CenterWelcomeNoAccount';
import { CenterWelcomeReady } from './CenterWelcomeReady';
import CloudIcon from '../icons/CloudIcon';

export const TestWelcome: FC = () => {
  const [mode, setMode] = useState<'no-account' | 'ready'>('ready');
  const [message, setMessage] = useState('');

  const mockAwsAccounts = [
    {
      id: 'test-aws-1',
      name: 'AWS Production',
      icon: <CloudIcon className="text-sm" />,
      accountId: '123456789012',
      region: 'us-east-1'
    }
  ];

  const mockGcpAccounts = [
    {
      id: 'test-gcp-1',
      name: 'GCP Analytics',
      icon: <CloudIcon className="text-sm" />,
      accountId: 'project-123',
      region: 'us-central1'
    }
  ];

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      backgroundColor: '#f5f5f5'
    }}>
      {/* 切换按钮 */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        display: 'flex',
        gap: 10
      }}>
        <button
          onClick={() => setMode('no-account')}
          style={{
            padding: '8px 16px',
            backgroundColor: mode === 'no-account' ? '#da7756' : '#fff',
            color: mode === 'no-account' ? '#fff' : '#000',
            border: '1px solid #ccc',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          无账号模式
        </button>
        <button
          onClick={() => setMode('ready')}
          style={{
            padding: '8px 16px',
            backgroundColor: mode === 'ready' ? '#da7756' : '#fff',
            color: mode === 'ready' ? '#fff' : '#000',
            border: '1px solid #ccc',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          已配置账号模式
        </button>
      </div>

      {/* 渲染欢迎页面 */}
      {mode === 'no-account' ? (
        <CenterWelcomeNoAccount />
      ) : (
        <CenterWelcomeReady
          message={message}
          onMessageChange={setMessage}
          onSend={() => console.log('发送消息:', message)}
          loading={false}
          awsAccounts={mockAwsAccounts}
          gcpAccounts={mockGcpAccounts}
          selectedAccountIds={[]}
          onSelectionChange={(ids) => console.log('选择账号:', ids)}
          cloudServicesLoading={false}
        />
      )}
    </div>
  );
};
