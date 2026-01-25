import React, { useState } from 'react';
import { Card, Typography, Button, Space, Tag, Collapse, Switch, Alert } from 'antd';
import { BugOutlined, ReloadOutlined, ClearOutlined, WarningOutlined } from '@ant-design/icons';
import { useErrorHandler } from '../../hooks/useErrorHandler';

const { Title, Text } = Typography;
const { Panel } = Collapse;

/**
 * 错误监控组件
 */
export const ErrorMonitor: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const {
    errors,

    clearErrors,
    resetFallback,
    getErrorStats,
    isFeatureEnabled
  } = useErrorHandler();

  const errorStats = getErrorStats();

  if (!isVisible) {
    return (
      <Button
        size="small"
        icon={<BugOutlined />}
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000
        }}
        danger={errorStats.total > 0}
      >
        错误监控 {errorStats.total > 0 && `(${errorStats.total})`}
      </Button>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'blue';
      default: return 'default';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '400px',
        maxHeight: '600px',
        zIndex: 1000,
        backgroundColor: 'white',
        border: '1px solid #d9d9d9',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}
    >
      <Card
        size="small"
        title={
          <Space>
            <BugOutlined />
            <span>错误监控</span>
            <Button
              size="small"
              type="text"
              onClick={() => setIsVisible(false)}
            >
              ×
            </Button>
          </Space>
        }
        extra={
          <Space>
            <Button size="small" icon={<ClearOutlined />} onClick={clearErrors}>
              清除
            </Button>
            <Button size="small" icon={<ReloadOutlined />} onClick={resetFallback}>
              重置
            </Button>
          </Space>
        }
        style={{ maxHeight: '600px', overflow: 'auto' }}
      >
        {/* 错误统计 */}
        <div style={{ marginBottom: '16px' }}>
          <Title level={5}>错误统计</Title>
          <Space wrap>
            <Tag color="default">总计: {errorStats.total}</Tag>
            <Tag color="red">严重: {errorStats.bySeverity.critical}</Tag>
            <Tag color="orange">高级: {errorStats.bySeverity.high}</Tag>
            <Tag color="yellow">中级: {errorStats.bySeverity.medium}</Tag>
            <Tag color="blue">低级: {errorStats.bySeverity.low}</Tag>
          </Space>
        </div>

        {/* 降级状态 */}
        <div style={{ marginBottom: '16px' }}>
          <Title level={5}>功能状态</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>滚动管理器:</Text>
              <Switch
                size="small"
                checked={isFeatureEnabled('enableScrollManager')}
                disabled
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>位置保持器:</Text>
              <Switch
                size="small"
                checked={isFeatureEnabled('enablePositionKeeper')}
                disabled
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>Hover效果:</Text>
              <Switch
                size="small"
                checked={isFeatureEnabled('enableHoverEffects')}
                disabled
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>平滑滚动:</Text>
              <Switch
                size="small"
                checked={isFeatureEnabled('enableSmoothScrolling')}
                disabled
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>性能监控:</Text>
              <Switch
                size="small"
                checked={isFeatureEnabled('enablePerformanceMonitoring')}
                disabled
              />
            </div>
          </Space>
        </div>

        {/* 最近错误 */}
        {errorStats.recent.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <Alert
              message="最近5分钟内有错误发生"
              type="warning"
              icon={<WarningOutlined />}
              showIcon
              closable
            />
          </div>
        )}

        {/* 错误列表 */}
        {errors.length > 0 ? (
          <div>
            <Title level={5}>错误详情</Title>
            <Collapse size="small">
              {errors.slice(-10).reverse().map((error, index) => (
                <Panel
                  key={index}
                  header={
                    <Space>
                      <Tag color={getSeverityColor(error.severity)}>
                        {error.severity}
                      </Tag>
                      <Text strong>{error.name}</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {formatTimestamp(error.timestamp)}
                      </Text>
                    </Space>
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>组件:</Text> {error.component || 'Unknown'}
                    </div>
                    <div>
                      <Text strong>消息:</Text> {error.message}
                    </div>
                    <div>
                      <Text strong>可恢复:</Text> {error.recoverable ? '是' : '否'}
                    </div>
                    {error.stack && (
                      <details>
                        <summary>堆栈跟踪</summary>
                        <pre style={{
                          fontSize: '10px',
                          backgroundColor: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          overflow: 'auto',
                          maxHeight: '200px'
                        }}>
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </Space>
                </Panel>
              ))}
            </Collapse>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Text type="secondary">暂无错误记录</Text>
          </div>
        )}

        {/* 组件统计 */}
        {Object.keys(errorStats.byComponent).length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <Title level={5}>组件错误统计</Title>
            <Space wrap>
              {Object.entries(errorStats.byComponent).map(([component, count]) => (
                <Tag key={component} color="default">
                  {component}: {count}
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
};
