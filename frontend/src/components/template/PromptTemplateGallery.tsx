import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  MoreOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  SendOutlined,
  StarFilled,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../stores/chatStore';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import { translateTemplateDescription, translateTemplateTitle } from '../../utils/templateTranslations';
import type {
  PromptTemplate,
  UserPromptTemplate,
  UserPromptTemplateCreate,
  UserPromptTemplateUpdate,
} from '../../types/promptTemplate';

const { Title, Text } = Typography;
const { Search, TextArea } = Input;

const categoryLabels: Record<string, { zh: string; en: string; color: string }> = {
  cost: { zh: '成本分析', en: 'Cost Analysis', color: 'orange' },
  risp: { zh: 'RI/SP 优化', en: 'RI/SP Optimization', color: 'blue' },
  audit: { zh: '资源审计', en: 'Resource Audit', color: 'red' },
  report: { zh: '报告生成', en: 'Reports', color: 'green' },
  custom: { zh: '我的', en: 'Mine', color: 'purple' },
};

const filterCategories = ['cost', 'risp', 'audit', 'report'] as const;

type AnyTemplate = PromptTemplate | UserPromptTemplate;

interface EditorValues {
  title: string;
  description?: string;
  prompt_text: string;
}

function normalizeText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildPromptPreview(promptText: string): string {
  const normalized = promptText.replace(/\s+/g, ' ').trim();
  return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
}

export const PromptTemplateGallery: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { language, t, isZhCN } = useI18n(['chat', 'common']);
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<UserPromptTemplate | null>(null);
  const [form] = Form.useForm<EditorValues>();

  const {
    systemTemplates,
    userTemplates,
    systemLoading,
    userLoading,
    error,
    loadSystemTemplates,
    loadUserTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    clearError,
    pinTemplate,
    unpinTemplate,
    pinnedTemplateIds,
  } = usePromptTemplateStore();

  useEffect(() => {
    loadSystemTemplates();
    loadUserTemplates();
  }, [loadSystemTemplates, loadUserTemplates]);

  const isLoading = systemLoading || userLoading;

  const allTemplates = useMemo<AnyTemplate[]>(
    () => [...systemTemplates, ...userTemplates],
    [systemTemplates, userTemplates],
  );

  const isUserTemplate = (template: AnyTemplate): template is UserPromptTemplate => 'user_id' in template;

  const getTitle = useCallback(
    (template: AnyTemplate) => (
      isUserTemplate(template) ? template.title : translateTemplateTitle(template.title, language)
    ),
    [language],
  );

  const getDescription = useCallback(
    (template: AnyTemplate) => (
      isUserTemplate(template)
        ? template.description
        : (translateTemplateDescription(template.description, language) || template.description)
    ),
    [language],
  );

  const getSummary = useCallback((template: AnyTemplate) => {
    const title = normalizeText(getTitle(template));
    const description = getDescription(template);
    const descriptionNormalized = normalizeText(description);

    if (description && descriptionNormalized && descriptionNormalized !== title && !title.includes(descriptionNormalized)) {
      return description;
    }

    return buildPromptPreview(template.prompt_text);
  }, [getDescription, getTitle]);

  const filteredTemplates = useMemo(
    () => allTemplates.filter((template) => {
      if (searchText.trim()) {
        const keyword = searchText.toLowerCase();
        const title = getTitle(template).toLowerCase();
        const description = (getDescription(template) || '').toLowerCase();
        const promptText = template.prompt_text.toLowerCase();
        if (!title.includes(keyword) && !description.includes(keyword) && !promptText.includes(keyword)) {
          return false;
        }
      }

      if (categoryFilter !== 'all' && template.category !== categoryFilter) {
        return false;
      }

      if (typeFilter === 'my' && !isUserTemplate(template)) {
        return false;
      }

      return !(typeFilter === 'system' && isUserTemplate(template));
    }),
    [allTemplates, categoryFilter, getDescription, getTitle, searchText, typeFilter],
  );

  const openCreateModal = () => {
    setEditingTemplate(null);
    form.resetFields();
    setEditorVisible(true);
  };

  const openEditModal = (template: UserPromptTemplate) => {
    setEditingTemplate(template);
    form.setFieldsValue({
      title: template.title,
      description: template.description,
      prompt_text: template.prompt_text,
    });
    setEditorVisible(true);
  };

  const closeEditorModal = () => {
    setEditorVisible(false);
    setEditingTemplate(null);
    form.resetFields();
  };

  const handleRetry = () => {
    clearError();
    loadSystemTemplates();
    loadUserTemplates();
  };

  const handleAddToChat = useCallback((template: AnyTemplate) => {
    useChatStore.getState().setPendingInput(template.prompt_text);
    navigate('/');
    message.success(isZhCN() ? '已添加到聊天输入框' : 'Added to chat input');
  }, [isZhCN, message, navigate]);

  const handleCopy = useCallback(async (template: AnyTemplate) => {
    try {
      await navigator.clipboard.writeText(template.prompt_text);
      message.success(isZhCN() ? '已复制' : 'Copied');
    } catch {
      message.error(isZhCN() ? '复制失败' : 'Copy failed');
    }
  }, [isZhCN, message]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteTemplate(id);
      message.success(isZhCN() ? '已删除' : 'Deleted');
      loadUserTemplates();
    } catch {
      message.error(isZhCN() ? '删除失败' : 'Delete failed');
    }
  }, [deleteTemplate, isZhCN, loadUserTemplates, message]);

  const handleEditorSubmit = async (values: EditorValues) => {
    try {
      if (editingTemplate) {
        const payload: UserPromptTemplateUpdate = {
          title: values.title,
          description: values.description,
          prompt_text: values.prompt_text,
        };
        await updateTemplate(editingTemplate.id, payload);
        message.success(isZhCN() ? '修改已保存' : 'Updated');
      } else {
        const payload: UserPromptTemplateCreate = {
          title: values.title,
          description: values.description,
          prompt_text: values.prompt_text,
          category: 'custom',
        };
        await createTemplate(payload);
        message.success(isZhCN() ? '创建成功' : 'Created');
      }

      closeEditorModal();
      loadUserTemplates();
    } catch {
      message.error(isZhCN() ? (editingTemplate ? '保存失败' : '创建失败') : (editingTemplate ? 'Update failed' : 'Create failed'));
    }
  };

  const buildMoreActions = (template: AnyTemplate): MenuProps['items'] => {
    const isPinned = pinnedTemplateIds.includes(template.id);
    const items: MenuProps['items'] = [
      {
        key: isPinned ? 'unpin' : 'pin',
        icon: isPinned ? <PushpinFilled /> : <PushpinOutlined />,
        label: isZhCN() ? (isPinned ? '取消固定' : '固定到对话框') : (isPinned ? 'Unpin' : 'Pin'),
      },
    ];

    if (isUserTemplate(template)) {
      items.push({
        key: 'edit',
        icon: <EditOutlined />,
        label: isZhCN() ? '编辑' : 'Edit',
      });
      items.push({
        key: 'delete',
        icon: <DeleteOutlined />,
        danger: true,
        label: isZhCN() ? '删除' : 'Delete',
      });
    }

    return items;
  };

  const handleMoreAction = (template: AnyTemplate, key: string) => {
    if (key === 'pin') {
      pinTemplate(template.id);
      message.success(isZhCN() ? '已固定到对话框' : 'Pinned');
      return;
    }

    if (key === 'unpin') {
      unpinTemplate(template.id);
      message.success(isZhCN() ? '已取消固定' : 'Unpinned');
      return;
    }

    if (key === 'edit' && isUserTemplate(template)) {
      openEditModal(template);
      return;
    }

    if (key === 'delete' && isUserTemplate(template)) {
      Modal.confirm({
        title: isZhCN() ? '确认删除该指令？' : 'Delete this action?',
        content: isZhCN() ? '删除后不可恢复。' : 'This action cannot be restored.',
        okText: isZhCN() ? '删除' : 'Delete',
        cancelText: isZhCN() ? '取消' : 'Cancel',
        okButtonProps: { danger: true },
        onOk: () => handleDelete(template.id),
      });
    }
  };

  const renderLoadingContent = () => (
    <Row gutter={[12, 12]}>
      {Array.from({ length: 6 }).map((_, index) => (
        <Col key={`template-skeleton-${index}`} xs={24} sm={12} lg={8}>
          <Card
            style={{ height: '100%', borderRadius: 14, minHeight: 196 }}
            styles={{ body: { padding: 18, display: 'flex', flexDirection: 'column', gap: 12 } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Skeleton.Input active size="small" style={{ width: 84 }} />
              <Skeleton.Button active size="small" shape="circle" />
            </div>
            <Skeleton.Input active size="small" style={{ width: '64%' }} />
            <Skeleton paragraph={{ rows: 2, width: ['100%', '72%'] }} title={false} active />
            <div style={{ display: 'flex', gap: 8 }}>
              <Skeleton.Button active size="small" style={{ width: 76 }} />
              <Skeleton.Button active size="small" style={{ width: 68 }} />
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderContent = () => {
    if (error) {
      return (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Text type="secondary">{isZhCN() ? '加载失败' : 'Load failed'}</Text>
          <br />
          <Button onClick={handleRetry} style={{ marginTop: 16 }}>
            {isZhCN() ? '重试' : 'Retry'}
          </Button>
        </Card>
      );
    }

    if (isLoading) {
      return renderLoadingContent();
    }

    if (filteredTemplates.length === 0) {
      return (
        <Card style={{ borderRadius: 16 }}>
          <Empty
            description={isZhCN() ? '当前筛选条件下没有匹配的快捷指令' : 'No actions match the current filters'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button onClick={() => {
              setSearchText('');
              setCategoryFilter('all');
              setTypeFilter('all');
            }}>
              {isZhCN() ? '清空筛选' : 'Clear filters'}
            </Button>
          </Empty>
        </Card>
      );
    }

    return (
      <Row gutter={[12, 12]}>
        {filteredTemplates.map((template) => {
          const categoryInfo = categoryLabels[template.category] || categoryLabels.custom;
          const isPinned = pinnedTemplateIds.includes(template.id);
          const isMine = isUserTemplate(template);
          const summary = getSummary(template);

          return (
            <Col key={template.id} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                style={{
                  height: '100%',
                  borderRadius: 14,
                  minHeight: 196,
                  border: isPinned ? '1px solid rgba(218, 119, 86, 0.28)' : '1px solid #ebeef3',
                  boxShadow: isPinned ? '0 10px 26px rgba(218, 119, 86, 0.10)' : '0 6px 18px rgba(15, 23, 42, 0.04)',
                }}
                styles={{
                  body: {
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    height: '100%',
                  },
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <Space wrap size={[6, 6]}>
                    <Tag color={isMine ? 'purple' : categoryInfo.color} style={{ margin: 0 }}>
                      {isMine ? (isZhCN() ? '我的' : 'Mine') : (isZhCN() ? categoryInfo.zh : categoryInfo.en)}
                    </Tag>
                    {isPinned && (
                      <Tag color="gold" style={{ margin: 0 }}>
                        {isZhCN() ? '已固定' : 'Pinned'}
                      </Tag>
                    )}
                  </Space>

                  <Dropdown
                    menu={{
                      items: buildMoreActions(template),
                      onClick: ({ key }) => handleMoreAction(template, String(key)),
                    }}
                    trigger={['click']}
                  >
                    <Button type="text" size="small" icon={<MoreOutlined />} />
                  </Dropdown>
                </div>

                <div style={{ minHeight: 72 }}>
                  <Text strong style={{ fontSize: 16, lineHeight: 1.4, display: 'block', marginBottom: 6 }}>
                    {isMine && template.is_favorite && (
                      <StarFilled style={{ color: '#faad14', marginRight: 6 }} />
                    )}
                    {getTitle(template)}
                  </Text>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {summary}
                  </Text>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 24 }}>
                  {template.variables && template.variables.length > 0 && (
                    <Tag bordered={false} color="default" style={{ margin: 0 }}>
                      {template.variables.length} {isZhCN() ? '个参数' : 'params'}
                    </Tag>
                  )}
                  {isMine && (
                    <Tag bordered={false} color="default" style={{ margin: 0 }}>
                      {isZhCN() ? '可编辑' : 'Editable'}
                    </Tag>
                  )}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button type="primary" icon={<SendOutlined />} onClick={() => handleAddToChat(template)}>
                    {isZhCN() ? '添加' : 'Add'}
                  </Button>
                  <Button icon={<CopyOutlined />} onClick={() => handleCopy(template)}>
                    {isZhCN() ? '复制' : 'Copy'}
                  </Button>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    );
  };

  return (
    <div
      style={{
        padding: isMobile ? 16 : 24,
        minHeight: '100vh',
        overflow: 'auto',
        background: '#f3f5f7',
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text">
              {t('common:button.back', 'Back')}
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              <FileTextOutlined /> {t('chat:templatePanel.title', 'Quick Actions')}
            </Title>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            {isZhCN() ? '新建指令' : 'Create'}
          </Button>
        </div>

        <Card
          style={{
            borderRadius: 18,
            border: '1px solid #ebeef3',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
          }}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
              {[
                { key: 'all', label: isZhCN() ? '全部' : 'All', mode: 'all' },
                ...filterCategories.map((key) => ({
                  key,
                  label: isZhCN() ? categoryLabels[key].zh : categoryLabels[key].en,
                  mode: 'category',
                })),
                { key: 'my', label: isZhCN() ? '我的指令' : 'Mine', mode: 'mine' },
              ].map((item) => {
                const isActive = item.mode === 'mine'
                  ? typeFilter === 'my'
                  : item.mode === 'all'
                    ? typeFilter === 'all' && categoryFilter === 'all'
                    : typeFilter === 'all' && categoryFilter === item.key;

                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      if (item.mode === 'mine') {
                        setTypeFilter('my');
                        setCategoryFilter('all');
                        return;
                      }

                      setTypeFilter('all');
                      setCategoryFilter(item.mode === 'all' ? 'all' : item.key);
                    }}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isActive ? '1px solid #1677ff' : '1px solid #d9d9d9',
                      background: isActive ? '#1677ff' : '#fff',
                      color: isActive ? '#fff' : '#595959',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <Search
              placeholder={isZhCN() ? '搜索标题或内容...' : 'Search actions...'}
              style={{ width: isMobile ? '100%' : 280 }}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              allowClear
            />
          </div>
        </Card>

        {renderContent()}
      </Space>

      <Modal
        title={editingTemplate ? (isZhCN() ? '编辑我的指令' : 'Edit custom action') : (isZhCN() ? '创建自定义指令' : 'Create custom action')}
        open={editorVisible}
        onCancel={closeEditorModal}
        onOk={() => form.submit()}
        okText={editingTemplate ? (isZhCN() ? '保存修改' : 'Save') : (isZhCN() ? '创建指令' : 'Create')}
        cancelText={isZhCN() ? '取消' : 'Cancel'}
        confirmLoading={userLoading}
        width={isMobile ? '92vw' : 680}
      >
        <Form form={form} layout="vertical" onFinish={handleEditorSubmit} style={{ marginTop: 12 }}>
          <Form.Item
            name="title"
            label={isZhCN() ? '标题' : 'Title'}
            rules={[{ required: true, message: isZhCN() ? '请输入标题' : 'Please enter a title' }]}
          >
            <Input maxLength={80} showCount />
          </Form.Item>

          <Form.Item
            name="description"
            label={isZhCN() ? '一句话说明' : 'Summary'}
            extra={isZhCN() ? '如果这句和标题重复，可以留空。' : 'Leave it empty if it repeats the title.'}
          >
            <Input maxLength={160} showCount />
          </Form.Item>

          <Form.Item
            name="prompt_text"
            label={isZhCN() ? '提示词内容' : 'Prompt'}
            rules={[{ required: true, message: isZhCN() ? '请输入提示词内容' : 'Please enter prompt content' }]}
            extra={isZhCN() ? '完整指令只在编辑时查看，不在卡片中默认展开。' : 'The full prompt is shown in editing only, not expanded by default on cards.'}
          >
            <TextArea rows={10} maxLength={4000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
