/**
 * ScrollIssueReporter - 滚动问题反馈组件
 *
 * 功能：
 * - 让用户报告滚动问题
 * - 收集问题详情和环境信息
 * - 提供快速恢复选项
 */

import React, { useState, useCallback } from 'react';
import { Button, Modal, Form, Input, Select, message } from 'antd';
import { BugOutlined, ReloadOutlined } from '@ant-design/icons';

import { logger } from '../../utils/logger';

const { TextArea } = Input;
const { Option } = Select;

interface ScrollIssueReporterProps {
  visible?: boolean;
  onClose?: () => void;
}

export const ScrollIssueReporter: React.FC<ScrollIssueReporterProps> = ({
  visible = false,
  onClose
}) => {
  const [isModalVisible, setIsModalVisible] = useState(visible);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleReport = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsModalVisible(false);
    onClose?.();
    form.resetFields();
  }, [onClose, form]);

  const handleSubmit = useCallback(async (values: any) => {
    setSubmitting(true);

    try {
      // 收集系统信息
      const systemInfo = {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        timestamp: Date.now(),
        url: window.location.href
      };

      // 构建报告数据（简化版，移除对ScrollPositionManager的依赖）
      const reportData = {
        ...values,
        systemInfo
      };

      // 这里可以发送到服务器
      logger.debug('[ScrollIssueReporter] 问题报告:', reportData);

      // 模拟提交
      await new Promise(resolve => setTimeout(resolve, 1000));

      message.success('问题报告已提交，感谢您的反馈！');
      handleCancel();
    } catch (error) {
      message.error('提交失败，请稍后重试');
      logger.error('Failed to submit report:', error);
    } finally {
      setSubmitting(false);
    }
  }, [handleCancel]);

  const handleQuickFix = useCallback((fixType: string) => {
    const mainContainer = document.querySelector('.ant-layout-content') as HTMLElement;
    if (!mainContainer) return;

    switch (fixType) {
      case 'restore':
        // 简单恢复到之前保存的位置
        const savedPos = sessionStorage.getItem('scroll-position');
        if (savedPos) {
          mainContainer.scrollTop = parseInt(savedPos, 10);
          message.info('已尝试恢复滚动位置');
        } else {
          message.info('没有保存的滚动位置');
        }
        break;
      case 'reset':
        mainContainer.scrollTop = 0;
        message.info('已重置到页面顶部');
        break;
      case 'unlock':
        // 移除可能的overflow限制
        mainContainer.style.overflow = 'auto';
        message.info('已解除滚动限制');
        break;
    }
  }, []);

  return (
    <>
      <Button
        type="text"
        icon={<BugOutlined />}
        onClick={handleReport}
        size="small"
        title="报告滚动问题"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid #d9d9d9'
        }}
      >
        报告问题
      </Button>

      <Modal
        title="滚动问题反馈"
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: '16px' }}>
          <h4>快速修复选项：</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              size="small"
              onClick={() => handleQuickFix('restore')}
              icon={<ReloadOutlined />}
            >
              恢复位置
            </Button>
            <Button
              size="small"
              onClick={() => handleQuickFix('reset')}
            >
              回到顶部
            </Button>
            <Button
              size="small"
              onClick={() => handleQuickFix('unlock')}
            >
              解除锁定
            </Button>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="issueType"
            label="问题类型"
            rules={[{ required: true, message: '请选择问题类型' }]}
          >
            <Select placeholder="请选择遇到的问题类型">
              <Option value="jump_to_top">页面跳转到顶部</Option>
              <Option value="cannot_scroll">无法滚动</Option>
              <Option value="scroll_freeze">滚动卡住</Option>
              <Option value="input_focus_issue">输入框焦点问题</Option>
              <Option value="other">其他问题</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="trigger"
            label="触发条件"
            rules={[{ required: true, message: '请描述触发条件' }]}
          >
            <Select placeholder="问题是在什么情况下发生的？">
              <Option value="mouse_hover">鼠标悬停在输入框</Option>
              <Option value="input_focus">输入框获得焦点</Option>
              <Option value="typing">输入文字时</Option>
              <Option value="scrolling">滚动页面时</Option>
              <Option value="message_send">发送消息后</Option>
              <Option value="other">其他情况</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="详细描述"
            rules={[{ required: true, message: '请详细描述问题' }]}
          >
            <TextArea
              rows={4}
              placeholder="请详细描述遇到的问题，包括具体的操作步骤和现象..."
            />
          </Form.Item>

          <Form.Item
            name="frequency"
            label="发生频率"
          >
            <Select placeholder="问题发生的频率">
              <Option value="always">每次都发生</Option>
              <Option value="often">经常发生</Option>
              <Option value="sometimes">偶尔发生</Option>
              <Option value="rare">很少发生</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button onClick={handleCancel}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
              >
                提交报告
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
