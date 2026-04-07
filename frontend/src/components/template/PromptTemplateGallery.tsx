/**
 * PromptTemplateGallery — 模板画廊
 *
 * 设计语言对齐 AlertManagement：
 * - #f0f2f5 灰色背景
 * - 返回按钮 + 标题行
 * - Card 包裹筛选栏
 * - Card 包裹内容区 Row/Col 卡片网格
 * - 点击卡片展开 Drawer 详情
 * - 无自定义 CSS，纯 inline styles + Ant Design
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Input, Spin, Tag, Button, Space, App,
  Card, Row, Col, Drawer, Popconfirm, Divider, Form,
} from 'antd';
import {
  ArrowLeftOutlined, StarFilled, PlusOutlined,
  CopyOutlined, SendOutlined, EditOutlined,
  DeleteOutlined, FileTextOutlined, PushpinOutlined, PushpinFilled,
  CheckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useChatStore } from '../../stores/chatStore';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import { translateTemplateTitle, translateTemplateDescription } from '../../utils/templateTranslations';
import type { PromptTemplate, UserPromptTemplate } from '../../types/promptTemplate';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

const categoryLabels: Record<string, { zh: string; en: string; color: string }> = {
  cost:       { zh: '成本分析', en: 'Cost Analysis',     color: 'orange' },
  risp:       { zh: 'RI/SP 优化', en: 'RI/SP Optimization', color: 'blue' },
  audit:      { zh: '资源审计', en: 'Resource Audit',    color: 'red' },
  report:     { zh: '报告生成', en: 'Reports',           color: 'green' },
  custom:     { zh: '自定义',   en: 'Custom',            color: 'default' },
};

/** 筛选栏展示的分类（不含 custom，因为和"我的指令"重复） */
const filterCategories = ['cost', 'risp', 'audit', 'report'] as const;

type AnyTemplate = PromptTemplate | UserPromptTemplate;

export const PromptTemplateGallery: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { language, t, isZhCN } = useI18n(['chat', 'common']);
  const { message: msg } = App.useApp();

  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [drawerTpl, setDrawerTpl] = useState<AnyTemplate | null>(null);
  const [managerVisible, setManagerVisible] = useState(false);

  const {
    systemTemplates, userTemplates,
    systemLoading, userLoading, error,
    loadSystemTemplates, loadUserTemplates,
    deleteTemplate, clearError, createTemplate,
    pinTemplate, unpinTemplate, pinnedTemplateIds,
  } = usePromptTemplateStore();

  const [createForm] = Form.useForm();

  useEffect(() => {
    loadSystemTemplates();
    loadUserTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = systemLoading || userLoading;
  const allTemplates: AnyTemplate[] = [...systemTemplates, ...userTemplates];
  const isUser = (tpl: AnyTemplate): tpl is UserPromptTemplate => 'user_id' in tpl;

  const filteredTemplates = allTemplates.filter((tpl) => {
    if (searchText) {
      const s = searchText.toLowerCase();
      const title = isUser(tpl) ? tpl.title : translateTemplateTitle(tpl.title, language);
      if (!title.toLowerCase().includes(s) && !tpl.description?.toLowerCase().includes(s)) return false;
    }
    if (categoryFilter !== 'all' && tpl.category !== categoryFilter) return false;
    if (typeFilter === 'system' && isUser(tpl)) return false;
    if (typeFilter === 'my' && !isUser(tpl)) return false;
    return true;
  });

  const getTitle = (tpl: AnyTemplate) =>
    isUser(tpl) ? tpl.title : translateTemplateTitle(tpl.title, language);
  const getDesc = (tpl: AnyTemplate) =>
    isUser(tpl)
      ? tpl.description
      : (translateTemplateDescription(tpl.description, language) || tpl.description);

  const renderCardActions = (tpl: AnyTemplate) => {
    const isPinnedCurrent = pinnedTemplateIds.includes(tpl.id);

    return (
      <Space wrap size={[6, 6]}>
        <Button
          size="small"
          type="text"
          icon={<SendOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleAddToChat(tpl);
          }}
        >
          {isZhCN() ? '添加' : 'Add'}
        </Button>
        <Button
          size="small"
          type="text"
          icon={isPinnedCurrent ? <PushpinFilled /> : <PushpinOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            if (isPinnedCurrent) {
              unpinTemplate(tpl.id);
              msg.success(isZhCN() ? '已取消固定' : 'Unpinned');
            } else {
              pinTemplate(tpl.id);
              msg.success(isZhCN() ? '已固定到对话框' : 'Pinned');
            }
          }}
        >
          {isZhCN() ? (isPinnedCurrent ? '已固定' : '固定') : (isPinnedCurrent ? 'Pinned' : 'Pin')}
        </Button>
        <Button
          size="small"
          type="text"
          icon={<CopyOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleCopy(tpl);
          }}
        >
          {isZhCN() ? '复制' : 'Copy'}
        </Button>
        {isUser(tpl) && (
          <Popconfirm
            title={isZhCN() ? '确认删除？' : 'Delete?'}
            onConfirm={() => handleDelete(tpl.id)}
            okText={isZhCN() ? '删除' : 'Delete'}
            cancelText={isZhCN() ? '取消' : 'Cancel'}
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              type="text"
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            >
              {isZhCN() ? '删除' : 'Delete'}
            </Button>
          </Popconfirm>
        )}
      </Space>
    );
  };

  const handleAddToChat = useCallback((tpl: AnyTemplate) => {
    // 通过 Zustand store 传递 prompt 文本，MessageInput 挂载时读取
    useChatStore.getState().setPendingInput(tpl.prompt_text);
    navigate('/');
    msg.success(isZhCN() ? '已添加到聊天输入框' : 'Added to chat input');
  }, [navigate, msg, isZhCN]);

  const handleCopy = useCallback(async (tpl: AnyTemplate) => {
    try {
      await navigator.clipboard.writeText(tpl.prompt_text);
      msg.success(isZhCN() ? '已复制' : 'Copied');
    } catch {
      msg.error(isZhCN() ? '复制失败' : 'Copy failed');
    }
  }, [msg, isZhCN]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteTemplate(id);
      msg.success(isZhCN() ? '已删除' : 'Deleted');
      setDrawerTpl(null);
      loadUserTemplates();
    } catch {
      msg.error(isZhCN() ? '删除失败' : 'Delete failed');
    }
  }, [deleteTemplate, msg, isZhCN, loadUserTemplates]);

  const handleRetry = () => {
    clearError();
    loadSystemTemplates();
    loadUserTemplates();
  };

  const handleCreateSubmit = useCallback(async (values: { title: string; description?: string; prompt_text: string }) => {
    try {
      await createTemplate({
        title: values.title,
        description: values.description,
        prompt_text: values.prompt_text,
        category: 'custom',
      });
      msg.success(isZhCN() ? '创建成功' : 'Created');
      createForm.resetFields();
      setManagerVisible(false);
      loadUserTemplates();
    } catch {
      msg.error(isZhCN() ? '创建失败' : 'Create failed');
    }
  }, [createTemplate, msg, isZhCN, createForm, loadUserTemplates]);

  /* ── Content area: error / loading / empty / grid ── */
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
      return (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </Card>
      );
    }

    // "创建自定义指令"卡片只在"全部"tab 下显示
    const showCreateCard = typeFilter === 'my';

    if (filteredTemplates.length === 0 && !showCreateCard) {
      return (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Text type="secondary">{isZhCN() ? '暂无模板' : 'No templates'}</Text>
        </Card>
      );
    }

    return (
      <Row gutter={[16, 16]}>
        {showCreateCard && (
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              onClick={() => setManagerVisible(true)}
              style={{
                height: '100%',
                borderRadius: 8,
                minHeight: 160,
                border: '2px dashed #d9d9d9',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              styles={{
                body: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 24,
                  width: '100%',
                },
              }}
            >
              <PlusOutlined style={{ fontSize: 28, color: '#bfbfbf' }} />
              <Text type="secondary" style={{ fontSize: 14 }}>
                {isZhCN() ? '创建自定义指令' : 'Create Action'}
              </Text>
            </Card>
          </Col>
        )}
        {filteredTemplates.map((tpl) => {
          const cat = tpl.category || 'custom';
          const catInfo = categoryLabels[cat] || categoryLabels.custom;
          return (
            <Col key={tpl.id} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                onClick={() => setDrawerTpl(tpl)}
                style={{ height: '100%', borderRadius: 8, minHeight: 210 }}
                styles={{
                  body: {
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    height: '100%',
                  },
                }}
              >
                {/* Tags row */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {!isUser(tpl) && (
                    <Tag color={catInfo.color} style={{ margin: 0 }}>
                      {isZhCN() ? catInfo.zh : catInfo.en}
                    </Tag>
                  )}
                  {isUser(tpl) && (
                    <Tag color="purple" style={{ margin: 0 }}>
                      {isZhCN() ? '我的' : 'Mine'}
                    </Tag>
                  )}
                </div>

                {/* Title */}
                <Text strong style={{ fontSize: 15, lineHeight: 1.4 }}>
                  {isUser(tpl) && tpl.is_favorite && (
                    <StarFilled style={{ color: '#faad14', marginRight: 4 }} />
                  )}
                  {getTitle(tpl)}
                </Text>

                {/* Description — 2 line clamp */}
                {getDesc(tpl) && (
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {getDesc(tpl)}
                  </Text>
                )}

                {/* Bottom info */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      fontSize: 12,
                      color: '#8c8c8c',
                    }}
                  >
                    {tpl.variables && tpl.variables.length > 0 && (
                      <span>
                        {tpl.variables.length} {isZhCN() ? '个参数' : 'params'}
                      </span>
                    )}
                  </div>
                  {renderCardActions(tpl)}
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
        height: 'calc(100vh - 0px)',
        overflow: 'auto',
        backgroundColor: '#f0f2f5',
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Header: back + title + create button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text">
              {t('common:button.back', 'Back')}
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              <FileTextOutlined /> {t('chat:templatePanel.title', 'Quick Actions')}
            </Title>
          </div>
        </div>

        {/* Search + Category pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            {[
              { key: 'all', label: isZhCN() ? '全部' : 'All' },
              ...filterCategories.map((k) => ({ key: k, label: isZhCN() ? categoryLabels[k].zh : categoryLabels[k].en })),
              { key: 'my', label: isZhCN() ? '我的指令' : 'Mine' },
            ].map((item) => {
              const isActive = (item.key === 'my' && typeFilter === 'my') ||
                (item.key !== 'my' && categoryFilter === item.key && typeFilter !== 'my');
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.key === 'my') { setTypeFilter('my'); setCategoryFilter('all'); }
                    else { setTypeFilter('all'); setCategoryFilter(item.key); }
                  }}
                  style={{
                    padding: '5px 16px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: isActive ? '1px solid #1677ff' : '1px solid #d9d9d9',
                    background: isActive ? '#1677ff' : '#fff',
                    color: isActive ? '#fff' : '#595959',
                    transition: 'all 0.2s',
                    outline: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <Search
            placeholder={isZhCN() ? '搜索...' : 'Search...'}
            style={{ width: 220 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </div>

        {/* Template grid */}
        {renderContent()}
      </Space>

      {/* Detail Drawer */}
      <Drawer
        title={drawerTpl ? getTitle(drawerTpl) : ''}
        open={!!drawerTpl}
        onClose={() => setDrawerTpl(null)}
        width={isMobile ? '100%' : 520}
        styles={{ body: { padding: 0 } }}
      >
        {drawerTpl && (() => {
          const isPinnedCurrent = pinnedTemplateIds.includes(drawerTpl.id);
          return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Meta tags */}
            <div style={{ padding: '16px 24px' }}>
              <Space wrap size={[6, 6]}>
                {!isUser(drawerTpl) && (
                  <Tag color={(categoryLabels[drawerTpl.category] || categoryLabels.custom).color}>
                    {isZhCN()
                      ? (categoryLabels[drawerTpl.category]?.zh || drawerTpl.category)
                      : (categoryLabels[drawerTpl.category]?.en || drawerTpl.category)}
                  </Tag>
                )}
                {isUser(drawerTpl) && (
                  <Tag color="purple">{isZhCN() ? '我的' : 'Mine'}</Tag>
                )}
                {drawerTpl.variables && drawerTpl.variables.length > 0 && (
                  <Tag color="blue">
                    {drawerTpl.variables.length} {isZhCN() ? '个参数' : 'params'}
                  </Tag>
                )}
              </Space>
            </div>

            {/* Description */}
            {getDesc(drawerTpl) && (
              <div style={{ padding: '0 24px 16px' }}>
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  {getDesc(drawerTpl)}
                </Paragraph>
              </div>
            )}

            <Divider style={{ margin: 0 }} />

            {/* Prompt content */}
            <div style={{ padding: '16px 24px 8px' }}>
              <Text
                strong
                style={{
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#8c8c8c',
                }}
              >
                {isZhCN() ? '指令内容' : 'Action Content'}
              </Text>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
              <pre
                style={{
                  margin: 0,
                  padding: 16,
                  background: '#f6f8fa',
                  border: '1px solid #e8e8e8',
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'Menlo, Monaco, Consolas, monospace',
                  color: '#1f1f1f',
                }}
              >
                {drawerTpl.prompt_text}
              </pre>
            </div>

            {/* Action bar */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid #f0f0f0',
              background: '#fff',
              display: 'flex',
              gap: 8,
            }}>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => { handleAddToChat(drawerTpl); setDrawerTpl(null); }}
                style={{ flex: 1, borderRadius: 8, height: 38, fontWeight: 600, background: '#da7756', borderColor: '#da7756' }}
              >
                {isZhCN() ? '添加到聊天' : 'Add to Chat'}
              </Button>
              <Button
                icon={isPinnedCurrent ? <PushpinFilled /> : <PushpinOutlined />}
                onClick={() => {
                  if (isPinnedCurrent) { unpinTemplate(drawerTpl.id); msg.success(isZhCN() ? '已取消固定' : 'Unpinned'); }
                  else { pinTemplate(drawerTpl.id); msg.success(isZhCN() ? '已固定到对话框' : 'Pinned'); }
                }}
                style={{ flex: 1, borderRadius: 8, height: 38, ...(isPinnedCurrent ? { borderColor: '#da7756', color: '#da7756' } : {}) }}
              >
                {isZhCN() ? (isPinnedCurrent ? '已固定' : '固定') : (isPinnedCurrent ? 'Pinned' : 'Pin')}
              </Button>
              <Button
                icon={<CopyOutlined />}
                onClick={() => handleCopy(drawerTpl)}
                style={{ flex: 1, borderRadius: 8, height: 38 }}
              >
                {isZhCN() ? '复制' : 'Copy'}
              </Button>
              {isUser(drawerTpl) && (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => setManagerVisible(true)}
                  style={{ flex: 1, borderRadius: 8, height: 38 }}
                >
                  {isZhCN() ? '编辑' : 'Edit'}
                </Button>
              )}
              {isUser(drawerTpl) && (
                <Popconfirm
                  title={isZhCN() ? '确认删除？' : 'Delete?'}
                  onConfirm={() => handleDelete(drawerTpl.id)}
                  okText={isZhCN() ? '删除' : 'Delete'}
                  cancelText={isZhCN() ? '取消' : 'Cancel'}
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    style={{ flex: 1, borderRadius: 8, height: 38 }}
                  >
                    {isZhCN() ? '删除' : 'Delete'}
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>
          );
        })()}
      </Drawer>

      {/* Create Drawer — 和查看详情同样的侧边栏体验 */}
      <Drawer
        title={isZhCN() ? '创建自定义指令' : 'Create Action'}
        open={managerVisible}
        onClose={() => { setManagerVisible(false); createForm.resetFields(); }}
        width={isMobile ? '100%' : 520}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
            <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit}>
              <Form.Item
                name="title"
                label={isZhCN() ? '标题' : 'Title'}
                rules={[{ required: true, message: isZhCN() ? '请输入标题' : 'Title required' }]}
              >
                <Input placeholder={isZhCN() ? '例如：月度成本汇总' : 'e.g. Monthly cost summary'} />
              </Form.Item>
              <Form.Item
                name="description"
                label={isZhCN() ? '描述（可选）' : 'Description (optional)'}
              >
                <Input placeholder={isZhCN() ? '简要说明这个指令的用途' : 'Brief description'} />
              </Form.Item>
              <Form.Item
                name="prompt_text"
                label={isZhCN() ? '指令内容' : 'Prompt Content'}
                rules={[{ required: true, message: isZhCN() ? '请输入指令内容' : 'Prompt required' }]}
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {isZhCN()
                      ? '支持使用 {{变量名}} 定义动态参数'
                      : 'Use {{variable}} for dynamic parameters'}
                  </Text>
                }
              >
                <Input.TextArea
                  rows={8}
                  placeholder={isZhCN()
                    ? '输入你的指令内容...\n\n例如：\n请分析 {{账号名称}} 在 {{月份}} 的成本趋势，重点关注 Top 10 服务的费用变化。'
                    : 'Enter your prompt...\n\ne.g.\nAnalyze the cost trend of {{account}} in {{month}}, focusing on Top 10 services.'}
                  style={{
                    fontFamily: 'Menlo, Monaco, Consolas, monospace',
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                />
              </Form.Item>
            </Form>
          </div>

          {/* 底部操作栏 — 和详情 Drawer 风格一致 */}
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid #f0f0f0',
            background: '#fff',
          }}>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => createForm.submit()}
              block
              size="large"
              loading={userLoading}
              style={{
                borderRadius: 10,
                fontWeight: 600,
                height: 44,
                fontSize: 15,
                background: '#da7756',
                borderColor: '#da7756',
              }}
            >
              {isZhCN() ? '创建指令' : 'Create Action'}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};
