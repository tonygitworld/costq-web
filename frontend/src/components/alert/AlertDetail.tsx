/**
 * Alert Detail - 告警详情页面
 */

import React, { useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  Tag,
  message,
  App
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';
import { useAlertStore } from '../../stores/alertStore';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { usePagination } from '../../hooks/usePagination';
import { useI18n } from '../../hooks/useI18n';
import { AWSStyleTable } from '../common/AWSStyleTable';
import { CardListView, type CardField } from '../common/CardListView';
import { CollapsibleDescription } from '../common/CollapsibleDescription';
import { MobilePageHeader } from '../common/MobilePageHeader';
import { useIsMobile } from '../../hooks/useIsMobile';
import { TruncateText } from '../common/TruncateText';
import type { AlertHistory } from '../../types/alert';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import 'dayjs/locale/ja';

import { logger } from '../../utils/logger';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

export const AlertDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { modal } = App.useApp();
  const { t } = useI18n('alert');

  const {
    currentAlert,
    alertHistory,
    loading,
    savingAlert,  // ✅ 添加 savingAlert 状态（用于测试按钮）
    fetchAlertById,
    fetchAlertHistory,
    deleteAlert,
    sendTestEmail
  } = useAlertStore();

  // ✅ 加载账号信息
  const { accounts: awsAccounts, fetchAccounts: fetchAWSAccounts } = useAccountStore();
  const { accounts: gcpAccounts, fetchAccounts: fetchGCPAccounts } = useGCPAccountStore();
  const { paginationProps } = usePagination(10);
  const isMobile = useIsMobile();

  // 加载数据
  useEffect(() => {
    logger.debug('🔍 AlertDetail useEffect - ID:', id);
    if (id) {
      loadData();
      fetchAWSAccounts();
      fetchGCPAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    logger.debug('📡 开始加载告警数据 - ID:', id);
    try {
      await Promise.all([
        fetchAlertById(id),
        fetchAlertHistory(id)
      ]);
      logger.debug('✅ 告警数据加载成功');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.loadFailed');
      logger.error('❌ 加载告警数据失败:', error);
      message.error(msg);
      navigate('/settings/alerts');
    }
  };

  // 删除告警
  const handleDelete = () => {
    if (!currentAlert) return;

    modal.confirm({
      title: t('confirm.deleteTitle'),
      content: t('confirm.deleteContent', { name: currentAlert.display_name }),
      okType: 'danger',
      okText: t('confirm.deleteOk'),
      cancelText: t('confirm.deleteCancel'),
      onOk: async () => {
        try {
          await deleteAlert(currentAlert.id);
          message.success(t('message.deleteSuccess'));
          navigate('/settings/alerts');
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : t('message.deleteFailed');
          message.error(msg);
        }
      }
    });
  };

  // 发送测试邮件
  const handleTest = async () => {
    if (!id || !currentAlert) return;

    // ✅ 检查账号ID
    if (!currentAlert.account_id) {
      message.warning(t('noAccountWarning'));
      return;
    }

    try {
      // ✅ 传递账号ID参数（与编辑页保持一致）
      await sendTestEmail(id, currentAlert.account_id);
      message.success(t('message.testEmailSent'));
      // ✅ 测试后刷新历史记录
      await fetchAlertHistory(id);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.testEmailFailed');
      message.error(msg);
    }
  };

  // 显示加载状态
  if (loading && !currentAlert) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Typography.Text>{t('loading')}</Typography.Text>
      </div>
    );
  }

  // 如果没有数据，显示提示
  if (!currentAlert) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Typography.Text type="secondary">{t('notFound')}</Typography.Text>
      </div>
    );
  }

  // ✅ 获取账号名称
  const getAccountName = () => {
    if (!currentAlert.account_id) {
      return <Tag color="default">{t('account.notSet')}</Tag>;
    }

    if (currentAlert.account_type === 'gcp') {
      const gcpAccount = gcpAccounts.find(a => a.id === currentAlert.account_id);
      return (
        <Tag color="blue" icon={<span>🔵</span>}>
          {t('account.gcp')}: {gcpAccount?.account_name || gcpAccount?.project_id || currentAlert.account_id?.slice(0, 8)}
        </Tag>
      );
    }

    // AWS
    const awsAccount = awsAccounts.find(a => a.id === currentAlert.account_id);
    return (
      <Tag color="orange" icon={<span>☁️</span>}>
        {t('account.aws')}: {awsAccount?.alias || awsAccount?.account_id || currentAlert.account_id?.slice(0, 8)}
      </Tag>
    );
  };

  // 计算统计数据
  const totalExecutions = alertHistory.length;
  const triggeredCount = alertHistory.filter(h => h.triggered).length;
  const successCount = alertHistory.filter(h => h.status === 'success').length;
  const successRate = totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0;

  // 移动端执行历史卡片字段
  const historyCardFields: CardField<AlertHistory>[] = [
    {
      label: t('history.columnTime'),
      key: 'executed_at',
      render: (v: string) => (
        <span style={{ fontWeight: 600, color: '#101828', fontSize: 13 }}>
          {dayjs(v).format('MM-DD HH:mm')}
        </span>
      ),
    },
    {
      label: t('history.columnStatus'),
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'success' ? 'success' : 'error'}>
          {status === 'success' ? t('history.statusSuccess') : t('history.statusFailed')}
        </Tag>
      ),
    },
    {
      label: t('history.columnTriggered'),
      key: 'triggered',
      render: (triggered: boolean) => (
        triggered ? <Tag color="warning">{t('history.triggered')}</Tag> : <Tag>{t('history.notTriggered')}</Tag>
      ),
    },
    {
      label: t('history.columnResult'),
      key: 'result_summary',
      render: (text: string) => <CollapsibleDescription text={text || ''} />,
      fullWidth: true,
    },
  ];

  // 执行历史表格列
  const historyColumns: ColumnsType<AlertHistory> = [
    {
      title: '●',
      key: 'indicator',
      width: 36,
      minWidth: 28,
      render: (_, record) => (
        <span style={{ fontSize: '16px' }}>
          {record.status === 'success' ? '✅' : '❌'}
        </span>
      )
    },
    {
      title: t('history.columnTime'),
      dataIndex: 'executed_at',
      key: 'executed_at',
      width: 170,
      minWidth: 110,
      sorter: (a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime(),
      showSorterTooltip: false,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: t('history.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      minWidth: 70,
      sorter: (a, b) => a.status.localeCompare(b.status),
      showSorterTooltip: false,
      render: (status) => (
        <Tag color={status === 'success' ? 'success' : 'error'}>
          {status === 'success' ? t('history.statusSuccess') : t('history.statusFailed')}
        </Tag>
      )
    },
    {
      title: t('history.columnTriggered'),
      dataIndex: 'triggered',
      key: 'triggered',
      width: 100,
      minWidth: 70,
      sorter: (a, b) => Number(a.triggered) - Number(b.triggered),
      showSorterTooltip: false,
      render: (triggered) => (
        triggered ? <Tag color="warning">{t('history.triggered')}</Tag> : <Tag>{t('history.notTriggered')}</Tag>
      )
    },
    {
      title: t('history.columnResult'),
      dataIndex: 'result_summary',
      key: 'result_summary',
      width: 300,
      minWidth: 120,
      sorter: (a, b) => (a.result_summary || '').localeCompare(b.result_summary || ''),
      showSorterTooltip: false,
      render: (text) => <TruncateText text={text || ''} maxLines={1} expandable modalTitle={t('history.columnResult')} expandLabel={t('common:button.expandView')} />
    }
  ];

  // ========== 移动端布局 ==========
  if (isMobile) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f5',
        overflow: 'hidden',
      }}>
        {/* 顶部栏 */}
        <MobilePageHeader
          title={currentAlert.display_name}
          onBack={() => navigate('/settings/alerts')}
        >
          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/settings/alerts/edit/${id}`)} size="small" style={{ flex: 1, borderRadius: 8, height: 32, color: '#344054' }}>
              {t('edit')}
            </Button>
            <Button icon={<SendOutlined />} onClick={handleTest} loading={savingAlert} size="small" style={{ flex: 1, borderRadius: 8, height: 32, color: '#344054' }}>
              {t('test')}
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete} size="small" style={{ flex: 1, borderRadius: 8, height: 32 }}>
              {t('delete')}
            </Button>
          </div>
        </MobilePageHeader>

        {/* 可滚动内容区 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          {/* 统计概览 - 2x2 网格 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: 12,
          }}>
            {[
              { label: t('overview.status'), value: currentAlert.is_active ? t('overview.enabled') : t('overview.disabled'), prefix: currentAlert.is_active ? '🟢' : '🔴' },
              { label: t('overview.executions'), value: totalExecutions },
              { label: t('overview.triggers'), value: triggeredCount },
              { label: t('overview.successRate'), value: `${successRate}%` },
            ].map((item) => (
              <div key={item.label} style={{
                background: '#fff',
                borderRadius: 10,
                padding: '12px 14px',
                border: '1px solid #eaecf0',
                boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
              }}>
                <div style={{ color: '#667085', fontSize: 12, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#101828' }}>
                  {item.prefix && <span style={{ marginRight: 4 }}>{item.prefix}</span>}
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* 告警配置 */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #eaecf0',
            boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
            padding: '14px 16px',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#101828', marginBottom: 10 }}>
              {t('card.config')}
            </div>
            {[
              { label: t('config.description'), value: null, node: <CollapsibleDescription text={currentAlert.description} /> },
              { label: t('config.account'), value: null, node: getAccountName() },
              { label: t('config.frequency'), value: t('config.frequencyValue') },
              { label: t('config.createdInfo'), value: t('config.createdBy', { name: currentAlert.created_by_username || t('table.unknown'), time: dayjs(currentAlert.created_at).fromNow() }) },
            ].map((item) => (
              <div key={item.label} style={{ padding: '8px 0', borderBottom: '1px solid #f2f4f7' }}>
                <div style={{ color: '#667085', fontSize: 12, marginBottom: 2 }}>{item.label}</div>
                <div style={{ color: '#344054', fontSize: 13, lineHeight: 1.5 }}>
                  {item.node || item.value || '-'}
                </div>
              </div>
            ))}
          </div>

          {/* 执行历史 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#101828' }}>
              {t('card.history')} ({totalExecutions})
            </span>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
              type="text"
              size="small"
              style={{ color: '#667085' }}
            />
          </div>

          <CardListView<AlertHistory>
            dataSource={alertHistory}
            rowKey="id"
            fields={historyCardFields}
            loading={loading}
            pagination={{
              ...paginationProps,
              total: alertHistory.length,
              showTotal: (total) => t('history.pagination', { total }),
            }}
          />
        </div>
      </div>
    );
  }

  // ========== 桌面端布局（保持不变） ==========
  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      background: '#f0f2f5',
      position: 'relative'
    }}>
      <Space direction="vertical" size="large" style={{
        width: '100%',
        padding: '24px',
        paddingBottom: '100px'  // ✅ 为底部内容留出空间
      }}>
        {/* 标题栏 */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/settings/alerts')}
            >
              {t('back')}
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              {currentAlert.display_name}
            </Title>
          </Space>
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/settings/alerts/edit/${id}`)}
            >
              {t('edit')}
            </Button>
            <Button
              icon={<SendOutlined />}
              onClick={handleTest}
              loading={savingAlert}
            >
              {t('test')}
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            >
              {t('delete')}
            </Button>
          </Space>
        </Space>

      {/* 告警概览 */}
      <Card title={t('card.overview')}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title={t('overview.status')}
              value={currentAlert.is_active ? t('overview.enabled') : t('overview.disabled')}
              prefix={currentAlert.is_active ? '🟢' : '🔴'}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('overview.executions')}
              value={totalExecutions}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('overview.triggers')}
              value={triggeredCount}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('overview.successRate')}
              value={successRate}
              suffix="%"
            />
          </Col>
        </Row>
      </Card>

      {/* 告警配置 */}
      <Card title={t('card.config')}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>{t('config.description')}</Text>
            <Paragraph style={{ marginTop: 8 }}>
              {currentAlert.description}
            </Paragraph>
          </div>
          {/* ✅ 新增：账号信息 */}
          <div>
            <Text strong>{t('config.account')}</Text>
            <Paragraph style={{ marginTop: 8 }}>
              {getAccountName()}
            </Paragraph>
          </div>
          <div>
            <Text strong>{t('config.frequency')}</Text>
            <Paragraph style={{ marginTop: 8 }}>
              {t('config.frequencyValue')}
            </Paragraph>
          </div>
          <div>
            <Text strong>{t('config.createdInfo')}</Text>
            <Paragraph style={{ marginTop: 8 }}>
              {t('config.createdBy', {
                name: currentAlert.created_by_username || t('table.unknown'),
                time: dayjs(currentAlert.created_at).fromNow()
              })}
            </Paragraph>
          </div>
        </Space>
      </Card>

      {/* 执行历史 */}
      <Card
        title={`${t('card.history')} (${t('history.totalRecords', { count: totalExecutions })})`}
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            {t('refresh')}
          </Button>
        }
      >
        <AWSStyleTable
          tableId="alert-history"
          columns={historyColumns}
          dataSource={alertHistory}
          rowKey="id"
          loading={loading}
          pagination={{
            ...paginationProps,
            total: alertHistory.length,
            showTotal: (total) => t('history.pagination', { total }),
          }}
          scroll={{
            x: 850,
            y: 'calc(100vh - 500px)'
          }}
        />
      </Card>
      </Space>
    </div>
  );
};
