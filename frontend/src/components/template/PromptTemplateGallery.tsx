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
  Card, Row, Col, Drawer, Popconfirm, Divider,
} from 'antd';
import {
  ArrowLeftOutlined, StarFilled, PlusOutlined,
  CopyOutlined, SendOutlined, EditOutlined,
  DeleteOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { usePromptTemplateStore } from '../../stores/promptTemplateStore';
import { useChatStore } from '../../stores/chatStore';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import { translateTemplateTitle, translateTemplateDescription } from '../../utils/templateTranslations';
import { CustomTemplateManager } from '../chat/CustomTemplateManager';
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
    deleteTemplate, clearError,
  } = usePromptTemplateStore();

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

    if (filteredTemplates.length === 0) {
      return (
        <Row gutter={[16, 16]}>
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
        </Row>
      );
    }

    return (
      <Row gutter={[16, 16]}>
        {/* 创建指令卡片 — 始终在第一个位置 */}
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
        {filteredTemplates.map((tpl) => {
          const cat = tpl.category || 'custom';
          const catInfo = categoryLabels[cat] || categoryLabels.custom;
          return (
            <Col key={tpl.id} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                onClick={() => setDrawerTpl(tpl)}
                style={{ height: '100%', borderRadius: 8, minHeight: 160 }}
                styles={{
                  body: {
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    height: '100%',
                  },
                }}
              >
                {/* Tags row */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Tag color={catInfo.color} style={{ margin: 0 }}>
                    {isZhCN() ? catInfo.zh : catInfo.en}
                  </Tag>
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
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: 8,
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
              ...Object.entries(categoryLabels).map(([k, v]) => ({ key: k, label: isZhCN() ? v.zh : v.en })),
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
        {drawerTpl && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Meta tags */}
            <div style={{ padding: '16px 24px' }}>
              <Space wrap size={[6, 6]}>
                <Tag color={(categoryLabels[drawerTpl.category] || categoryLabels.custom).color}>
                  {isZhCN()
                    ? (categoryLabels[drawerTpl.category]?.zh || drawerTpl.category)
                    : (categoryLabels[drawerTpl.category]?.en || drawerTpl.category)}
                </Tag>
                {isUser(drawerTpl) && (
                  <Tag color="purple">{isZhCN() ? '我的指令' : 'My Action'}</Tag>
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

            {/* Action buttons — fixed bottom */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => {
                  handleAddToChat(drawerTpl);
                  setDrawerTpl(null);
                }}
                block
                size="large"
                style={{ marginBottom: 10, borderRadius: 8, fontWeight: 600 }}
              >
                {isZhCN() ? '添加到聊天' : 'Add to Chat'}
              </Button>
              <Space style={{ width: '100%' }}>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(drawerTpl)}
                  style={{ flex: 1, borderRadius: 8 }}
                >
                  {isZhCN() ? '复制' : 'Copy'}
                </Button>
                {isUser(drawerTpl) && (
                  <>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => setManagerVisible(true)}
                      style={{ flex: 1, borderRadius: 8 }}
                    >
                      {isZhCN() ? '编辑' : 'Edit'}
                    </Button>
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
                        style={{ flex: 1, borderRadius: 8 }}
                      >
                        {isZhCN() ? '删除' : 'Delete'}
                      </Button>
                    </Popconfirm>
                  </>
                )}
              </Space>
            </div>
          </div>
        )}
      </Drawer>

      <CustomTemplateManager
        visible={managerVisible}
        onClose={() => {
          setManagerVisible(false);
          loadUserTemplates();
        }}
      />
    </div>
  );
};
