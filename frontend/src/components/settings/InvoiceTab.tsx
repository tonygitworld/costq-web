/**
 * Settings - Invoice Tab（客户侧）
 */
import { Alert, Button, Empty, message, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { invoiceApi, type Invoice } from '../../services/invoiceApi';
import { useI18n } from '../../hooks/useI18n';

const { Title, Text } = Typography;

export default function InvoiceTab() {
  const { t } = useI18n(['invoice', 'common']);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoiceApi.list,
  });

  const handleDownload = async (invoice: Invoice) => {
    try {
      const res = await invoiceApi.download(invoice.id);
      window.open(res.download_url, '_blank');
    } catch {
      message.error(t('invoice:downloadFailed'));
    }
  };

  const columns = [
    {
      title: t('invoice:invoiceNumber'),
      dataIndex: 'invoice_number',
      render: (v: string) => (
        <Space>
          <FileTextOutlined style={{ color: '#1a73e8' }} />
          <Text style={{ fontFamily: 'monospace' }}>{v}</Text>
        </Space>
      ),
    },
    {
      title: t('invoice:period'),
      render: (_: unknown, r: Invoice) =>
        `${r.period_year}-${String(r.period_month).padStart(2, '0')}`,
    },
    {
      title: t('invoice:cloudSpend'),
      dataIndex: 'cloud_cost_total',
      align: 'right' as const,
      render: (v: number) =>
        `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('invoice:serviceFee'),
      dataIndex: 'costq_fee',
      align: 'right' as const,
      render: (v: number) =>
        `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('invoice:status'),
      dataIndex: 'status',
      render: () => <Tag color="success">{t('invoice:statusGenerated')}</Tag>,
    },
    {
      title: t('invoice:date'),
      dataIndex: 'generated_at',
      render: (v: string) =>
        v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '',
      width: 80,
      render: (_: unknown, r: Invoice) => (
        <Tooltip title={t('invoice:download')}>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(r)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        {t('invoice:title')}
      </Title>

      {isError ? (
        <Alert
          type="error"
          showIcon
          message={t('common:errors.loadFailed', { defaultValue: 'Load failed' })}
          description={error instanceof Error ? error.message : undefined}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {data?.items?.length === 0 && !isLoading ? (
        <Empty description={t('invoice:noInvoices')} />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isLoading}
          pagination={false}
          size="middle"
        />
      )}
    </div>
  );
}
