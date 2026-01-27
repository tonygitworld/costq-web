/**
 * useTemplateExecution - 模板执行的共享 Hook
 *
 * 处理模板点击、变量填写和发送逻辑
 */

import { useState } from 'react';
import { Form, message } from 'antd';
import type { PromptTemplate, UserPromptTemplate } from '../types/promptTemplate';
import { executeTemplate } from '../services/promptTemplateApi';
import { useChatStore } from '../stores/chatStore';
import { useSSEContext } from '../contexts/SSEContext';
import { useAccountStore } from '../stores/accountStore';
import { useGCPAccountStore } from '../stores/gcpAccountStore';

import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/ErrorHandler';

// 模板变量值类型
type TemplateVariables = Record<string, string | number | boolean>;

export const useTemplateExecution = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | UserPromptTemplate | null>(null);
  const [variableForm] = Form.useForm();
  const { sendMessage } = useSSEContext();
  const { currentChatId, createNewChat, addMessage } = useChatStore();
  const { selectedAccountIds } = useAccountStore();
  const { selectedAccountIds: selectedGCPAccountIds } = useGCPAccountStore();

  const executeAndSend = async (templateId: string, variables: TemplateVariables) => {
    try {
      // 调用后端渲染模板
      const result = await executeTemplate(templateId, { variables });

      // 确保有当前聊天
      let chatId = currentChatId;
      if (!chatId) {
        chatId = createNewChat();  // ✅ 同步创建临时会话
      }

      // 添加用户消息到本地 store
      addMessage(chatId, {
        chatId,
        type: 'user',
        content: result.rendered_prompt,
        meta: {
          status: 'completed',
          isStreaming: false,
          streamingProgress: 100,
          retryCount: 0,
          maxRetries: 0,
          canRetry: false,
          canEdit: true,
          canDelete: true
        }
      });

      // 发送渲染后的 Prompt 到 SSE
      sendMessage({
        content: result.rendered_prompt,
        account_ids: selectedAccountIds,
        gcp_account_ids: selectedGCPAccountIds
      });

      message.success('✅ 模板已发送');
      logger.debug(`✅ 模板执行并发送成功 - Template: ${templateId}, Prompt: ${result.rendered_prompt}`);
    } catch (error: unknown) {
      logger.error('❌ 执行模板失败:', error);
      message.error(`❌ ${getErrorMessage(error, '发送失败')}`);
    }
  };

  const handleTemplateClick = (template: PromptTemplate | UserPromptTemplate) => {
    // 如果模板有变量，显示填写表单
    if (template.variables && template.variables.length > 0) {
      setSelectedTemplate(template);

      // 设置默认值
      const defaultValues: TemplateVariables = {};
      template.variables.forEach(v => {
        if (v.default !== undefined) {
          defaultValues[v.name] = v.default;
        }
      });
      variableForm.setFieldsValue(defaultValues);
    } else {
      // 直接发送（无变量）
      executeAndSend(template.id, {});
    }
  };

  const handleVariableFormSubmit = async (values: TemplateVariables) => {
    if (!selectedTemplate) return;

    await executeAndSend(selectedTemplate.id, values);

    // 关闭弹窗
    setSelectedTemplate(null);
    variableForm.resetFields();
  };

  const closeVariableForm = () => {
    setSelectedTemplate(null);
    variableForm.resetFields();
  };

  return {
    selectedTemplate,
    variableForm,
    handleTemplateClick,
    handleVariableFormSubmit,
    closeVariableForm
  };
};
