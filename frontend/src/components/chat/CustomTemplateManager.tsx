/**
 * CustomTemplateManager - 我的模板管理界面
 *
 * 用户可以创建、编辑、删除自己的模板
 */

import React, { useState, useEffect } from 'react';
import { Modal, Button, Flex, Space, Empty, Popconfirm, message, Form, Input, Spin, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled } from '@ant-design/icons';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useTemplateExecution } from '../../hooks/useTemplateExecution';
import { useI18n } from '../../hooks/useI18n';
import type { UserPromptTemplate } from '../../types/promptTemplate';
import { getErrorMessage } from '../../utils/ErrorHandler';

const { TextArea } = Input;

// 模板表单值类型
interface TemplateFormValues {
  title: string;
  description: string;
  prompt_text: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  zIndex?: number;
}

export const CustomTemplateManager: React.FC<Props> = ({ visible, onClose, zIndex }) => {
  const {
    userTemplates,
    loadUserTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleFavorite,
    userLoading,
    error
  } = usePromptTemplateStore();

  const {
    handleTemplateClick
  } = useTemplateExecution();

  const { t } = useI18n(['template', 'common']);

  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<UserPromptTemplate | null>(null);
  const [form] = Form.useForm();

  // 按收藏状态排序：收藏的在前面
  const sortedTemplates = [...userTemplates].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    // 相同收藏状态按更新时间倒序
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  useEffect(() => {
    if (visible) {
      loadUserTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]); // 只依赖 visible，避免无限循环

  // 创建新模板
  const handleCreate = () => {
    setIsEditing(true);
    setEditingTemplate(null);
    form.resetFields();
  };

  // 编辑模板
  const handleEdit = (template: UserPromptTemplate) => {
    setIsEditing(true);
    setEditingTemplate(template);
    form.setFieldsValue({
      title: template.title,
      description: template.description,
      prompt_text: template.prompt_text
    });
  };

  // 保存模板
  const handleSave = async (values: TemplateFormValues) => {
    try {
      if (editingTemplate) {
        // 更新现有模板
        await updateTemplate(editingTemplate.id, {
          title: values.title,
          description: values.description,
          prompt_text: values.prompt_text
        });
        message.success(t('manager.message.updateSuccess'));
      } else {
        // 创建新模板
        await createTemplate({
          title: values.title,
          description: values.description,
          prompt_text: values.prompt_text,
          category: 'custom'
        });
        message.success(t('manager.message.createSuccess'));
      }
      setIsEditing(false);
      form.resetFields();
      loadUserTemplates(); // 刷新列表
    } catch (error: unknown) {
      message.error(`${t('manager.message.operationFailed')}: ${getErrorMessage(error)}`);
    }
  };

  // 删除模板
  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      message.success('✅ 模板已删除');
      loadUserTemplates();
    } catch (error: unknown) {
      message.error(`❌ 删除失败: ${getErrorMessage(error)}`);
    }
  };

  // 切换收藏
  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发模板点击
    try {
      await toggleFavorite(id);
      loadUserTemplates();
    } catch (error: unknown) {
      message.error(`❌ 操作失败: ${getErrorMessage(error)}`);
    }
  };

  // 执行模板
  const handleUseTemplate = async (template: UserPromptTemplate) => {
    // 直接传递用户模板（useTemplateExecution 已支持）
    await handleTemplateClick(template);

    // 如果没有变量，直接关闭弹窗
    if (!template.variables || template.variables.length === 0) {
      onClose();
    }
  };

  return (
    <Modal
      title={t('customManager.title')}
      open={visible}
      onCancel={() => {
        setIsEditing(false);
        onClose();
      }}
      footer={null}
      width={700}
      zIndex={zIndex}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      {/* 创建按钮 */}
      {!isEditing && (
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            block
          >
            {t('customManager.createButton')}
          </Button>
        </div>
      )}

      {/* 编辑表单 */}
      {isEditing && (
        <div style={{
          marginBottom: 24,
          padding: 16,
          background: '#fafafa',
          borderRadius: 8,
          border: '1px dashed #d9d9d9'
        }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
          >
            <Form.Item
            label={t('customManager.templateTitle')}
            name="title"
            rules={[{ required: true, message: t('customManager.validation.titleRequired') }]}
            >
              <Input placeholder={t('customManager.templateTitlePlaceholder')} />
            </Form.Item>

            <Form.Item
            label={t('customManager.description')}
            name="description"
          >
            <Input placeholder={t('customManager.descriptionPlaceholder')} />
            </Form.Item>

            <Form.Item
            label={t('customManager.templateContent')}
            name="prompt_text"
            rules={[{ required: true, message: t('customManager.validation.contentRequired') }]}
              extra={t('customManager.contentHint')}
            >
              <TextArea
                rows={4}
                placeholder={t('customManager.contentPlaceholder')}
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={userLoading}>
                  {editingTemplate ? t('customManager.updateButton') : t('customManager.createButton2')}
                </Button>
                <Button onClick={() => {
                  setIsEditing(false);
                  form.resetFields();
                }}>
                  {t('common:button.cancel')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      )}

      {/* 模板列表 */}
      {userLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : userTemplates.length === 0 ? (
        <Empty
          description={t('customManager.emptyState')}
          style={{ padding: '40px 0' }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('customManager.createFirstTemplate')}
          </Button>
        </Empty>
      ) : (
        <Flex vertical gap={8}>
          {sortedTemplates.map((template) => (
            <div
              key={template.id}
              style={{
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #f0f0f0',
                transition: 'all 0.2s',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px'
              }}
              onClick={() => handleUseTemplate(template)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fafafa';
                e.currentTarget.style.borderColor = '#d9d9d9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = '#f0f0f0';
              }}
            >
              {/* 内容区域 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 8 }}>
                  <Space>
                    {template.is_favorite && <StarFilled style={{ color: '#faad14', fontSize: 14 }} />}
                    <Typography.Text strong>{template.title}</Typography.Text>
                  </Space>
                </div>
                {template.description && (
                  <div style={{ marginBottom: 8, color: '#8c8c8c', fontSize: 13 }}>
                    {template.description}
                  </div>
                )}
                <div style={{
                  fontSize: 12,
                  color: '#595959',
                  background: '#f5f5f5',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  marginBottom: 4
                }}>
                  {template.prompt_text.length > 100
                    ? template.prompt_text.substring(0, 100) + '...'
                    : template.prompt_text
                  }
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#bfbfbf' }}>
                  使用次数: {template.usage_count}
                </div>
              </div>

              {/* 操作按钮区域 */}
              <Space size={4} onClick={(e) => e.stopPropagation()}>
                <Button
                  type="text"
                  icon={template.is_favorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                  onClick={(e) => handleToggleFavorite(template.id, e)}
                />
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(template);
                  }}
                >
                  编辑
                </Button>
                <Popconfirm
                  title="确认删除？"
                  description={t('customManager.confirmDeleteDesc')}
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    handleDelete(template.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText={t('common:button.delete')}
                  cancelText={t('common:button.cancel')}
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  >
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          ))}
        </Flex>
      )}

      {/* 底部统计 */}
      {!userLoading && userTemplates.length > 0 && (
        <div style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid #f0f0f0',
          textAlign: 'center',
          color: '#8c8c8c',
          fontSize: 13
        }}>
          共 {userTemplates.length} 个自定义模板
          {userTemplates.filter(t => t.is_favorite).length > 0 && (
            <> · ⭐ {userTemplates.filter(t => t.is_favorite).length} 个收藏（显示在主界面）</>
          )}
        </div>
      )}

      {/* 变量填写表单在 useTemplateExecution 中管理，这里不需要重复渲染 */}

      {/* 错误提示 */}
      {error && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: '#fff2f0',
          border: '1px solid #ffccc7',
          borderRadius: 4,
          color: '#ff4d4f'
        }}>
          ❌ {error}
        </div>
      )}
    </Modal>
  );
};
