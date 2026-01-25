// Test data for agent workflow display
// This file provides mock data to test the new features

import { type Message } from '../types/chat';

// 生成测试消息 ID
const generateTestId = () => 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

/**
 * 创建一个带有思考过程和工具调用的测试消息
 */
export function createTestMessageWithWorkflow(chatId: string): Message {
  const now = Date.now();

  return {
    id: generateTestId(),
    chatId: chatId,
    type: 'assistant',
    content: `根据查询结果，您本月（2025年10月）的 **AWS 成本**为 **$27,506.25**。

## 💰 成本明细

| 服务 | 成本 | 占比 |
|------|------|------|
| EC2 实例 | $15,230.45 | 55% |
| S3 存储 | $8,120.30 | 30% |
| RDS 数据库 | $4,155.50 | 15% |

## 📈 趋势分析

相比上月增长了 **12.5%**，主要原因是：
1. EC2 实例数量增加了 3 台
2. S3 存储容量增长了 500GB
3. RDS 数据库升级到更高配置

## 💡 优化建议

1. **EC2 优化**：考虑使用 Spot 实例可节省 40-60%
2. **S3 优化**：启用生命周期策略，将旧数据移至 Glacier
3. **RDS 优化**：评估是否需要当前配置，可以考虑降级`,
    timestamp: now,
    meta: {
      status: 'completed',
      isStreaming: false,
      streamingProgress: 100,
      retryCount: 0,
      maxRetries: 3,
      canRetry: true,
      canEdit: false,
      canDelete: true,
      startTime: now - 4100,
      endTime: now
    },

    // ✨ 思考过程数据
    thinking: {
      steps: [
        '分析用户查询：需要查询 2025年10月 的 AWS 成本数据',
        '选择合适的工具：get_cost_and_usage 可以获取成本详情',
        '确定查询参数：时间范围 10月1日-14日，按服务分组',
        '规划回答结构：总成本 + 服务明细 + 趋势分析 + 优化建议'
      ],
      duration: 2.3,
      startTime: now - 4100,
      endTime: now - 1800
    },

    // ✨ 工具调用数据
    toolCalls: [{
      id: 'call_cost_explorer_001',
      name: 'get_cost_and_usage',
      description: 'Querying AWS Cost Explorer for October 2025 cost data',
      status: 'success',
      args: {
        time_period: {
          start: '2025-10-01',
          end: '2025-10-14'
        },
        granularity: 'MONTHLY',
        metrics: ['UnblendedCost'],
        group_by: [{
          type: 'DIMENSION',
          key: 'SERVICE'
        }],
        filter: {
          dimensions: {
            key: 'RECORD_TYPE',
            values: ['Usage']
          }
        }
      },
      result: {
        total_cost: 27506.25,
        currency: 'USD',
        time_period: {
          start: '2025-10-01',
          end: '2025-10-14'
        },
        breakdown_by_service: [
          {
            service: 'Amazon Elastic Compute Cloud - Compute',
            cost: 15230.45,
            percentage: 55.3
          },
          {
            service: 'Amazon Simple Storage Service',
            cost: 8120.30,
            percentage: 29.5
          },
          {
            service: 'Amazon Relational Database Service',
            cost: 4155.50,
            percentage: 15.1
          }
        ],
        comparison_with_last_month: {
          last_month_cost: 24450.00,
          change_amount: 3056.25,
          change_percentage: 12.5
        }
      },
      duration: 1.8,
      startTime: now - 1800,
      endTime: now
    }]
  };
}

/**
 * 创建一个带有多个工具调用的测试消息
 */
export function createTestMessageWithMultipleTools(chatId: string): Message {
  const now = Date.now();

  return {
    id: generateTestId(),
    chatId: chatId,
    type: 'assistant',
    content: `根据成本分析和预测，以下是您的 AWS 账单情况：

## 📊 本月成本（实际）
**$27,506.25**

## 🔮 下月预测
**$29,800.00** （预计增长 8.3%）

## ⚠️ 预警
下月成本预计将超出预算 $5,000！

## 🎯 建议
立即采取成本优化措施，重点关注 EC2 和 S3。`,
    timestamp: now,
    meta: {
      status: 'completed',
      isStreaming: false,
      streamingProgress: 100,
      retryCount: 0,
      maxRetries: 3,
      canRetry: true,
      canEdit: false,
      canDelete: true
    },

    thinking: {
      steps: [
        '需要同时获取当前成本和未来预测',
        '第一步：调用 get_cost_and_usage 获取当前成本',
        '第二步：调用 get_cost_forecast 获取预测成本',
        '综合两个结果生成报告'
      ],
      duration: 1.5
    },

    // 多个工具调用
    toolCalls: [
      {
        id: 'call_001',
        name: 'get_cost_and_usage',
        description: 'Querying current month AWS costs',
        status: 'success',
        args: {
          time_period: {
            start: '2025-10-01',
            end: '2025-10-14'
          },
          granularity: 'MONTHLY'
        },
        result: {
          total_cost: 27506.25,
          currency: 'USD'
        },
        duration: 1.2
      },
      {
        id: 'call_002',
        name: 'get_cost_forecast',
        description: 'Forecasting next month AWS costs',
        status: 'success',
        args: {
          time_period: {
            start: '2025-11-01',
            end: '2025-11-30'
          },
          metric: 'UNBLENDED_COST',
          granularity: 'MONTHLY'
        },
        result: {
          forecast_cost: 29800.00,
          currency: 'USD',
          confidence_interval: {
            lower: 27500.00,
            upper: 32100.00
          }
        },
        duration: 2.1
      }
    ]
  };
}

/**
 * 创建一个带有错误的测试消息
 */
export function createTestMessageWithError(chatId: string): Message {
  const now = Date.now();

  return {
    id: generateTestId(),
    chatId: chatId,
    type: 'assistant',
    content: `抱歉，无法获取成本数据。请检查以下内容：

1. **权限检查**：确保 IAM 角色有 Cost Explorer 访问权限
2. **服务启用**：确认 Cost Explorer 服务已启用
3. **区域设置**：Cost Explorer 仅在 us-east-1 区域可用

请联系管理员解决权限问题后重试。`,
    timestamp: now,
    meta: {
      status: 'completed',
      isStreaming: false,
      streamingProgress: 100,
      retryCount: 0,
      maxRetries: 3,
      canRetry: true,
      canEdit: false,
      canDelete: true
    },

    thinking: {
      steps: [
        '准备调用 get_cost_and_usage 工具',
        '检测到权限问题，调用失败',
        '生成错误提示和解决方案'
      ],
      duration: 0.8
    },

    toolCalls: [{
      id: 'call_error_001',
      name: 'get_cost_and_usage',
      description: 'Attempting to query AWS Cost Explorer',
      status: 'error',
      args: {
        time_period: {
          start: '2025-10-01',
          end: '2025-10-14'
        }
      },
      error: 'AccessDeniedException: User is not authorized to perform ce:GetCostAndUsage on resource. Please ensure the IAM role has the required Cost Explorer permissions.',
      duration: 0.5
    }]
  };
}

/**
 * 创建一个没有新功能的普通测试消息（向后兼容测试）
 */
export function createTestMessageOldFormat(chatId: string): Message {
  return {
    id: generateTestId(),
    chatId: chatId,
    type: 'assistant',
    content: `这是一条**普通的 AI 消息**，用于测试向后兼容性。

- 没有思考过程
- 没有工具调用
- 只有纯文本内容

**所有现有功能应该正常工作：**
1. ✅ Markdown 渲染
2. ✅ PDF 下载
3. ✅ 复制功能`,
    timestamp: Date.now(),
    meta: {
      status: 'completed',
      isStreaming: false,
      streamingProgress: 100,
      retryCount: 0,
      maxRetries: 3,
      canRetry: true,
      canEdit: false,
      canDelete: true
    }
    // 注意：没有 thinking 和 toolCalls 字段
  };
}

/**
 * 注入测试消息到当前对话
 * 使用方法：在浏览器控制台执行
 * window.injectTestMessage('workflow') 或 'multi' 或 'error' 或 'old'
 */
export function setupTestDataInjection() {
  // 暴露到 window 对象，方便在浏览器控制台调用
  if (typeof window !== 'undefined') {
    (window as any).injectTestMessage = (type: 'workflow' | 'multi' | 'error' | 'old' = 'workflow') => {
      // 这个函数会在浏览器控制台被调用
      console.log(`Injecting test message: ${type}`);
      console.log('Note: You need to manually call useChatStore and add the message');
      console.log('Example:');
      console.log(`
import { useChatStore } from './stores/chatStore';
import { createTestMessageWithWorkflow } from './utils/testData';

const store = useChatStore.getState();
const currentChatId = store.currentChatId;
if (currentChatId) {
  const testMessage = createTestMessageWithWorkflow(currentChatId);
  store.addMessage(currentChatId, testMessage);
}
      `);
    };
  }
}
