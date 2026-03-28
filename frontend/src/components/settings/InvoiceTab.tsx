/**
 * Settings - Invoice Tab（客户侧）
 */
import { Alert, Button, Card, Empty, message, Space, Tag, Tooltip, Typography } from 'antd';
import { DownloadOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { invoiceApi, type Invoice } from '../../services/invoiceApi';
import { useI18n } from '../../hooks/useI18n';
import { AWSStyleTable } from '../common/AWSStyleTable';
import { usePagination } from '../../hooks/usePagination';

const { Title, Text } = Typography;

export default function InvoiceTab() {
  const { t } = useI18n(['invoice', 'common']);
  const { paginationProps } = usePagination(10);

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoiceApi.list,
  });

  const items = data?.items ?? [];

  const handleRefresh = async () => {
    const result = await refetch();
    if (result.error) {
      message.error(t('common:message.operationFailed'));
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    try {
      const res = await invoiceApi.download(invoice.id);
      window.open(res.download_url, '_blank');
    } catch {
      message.error(t('invoice:downloadFailed'));
    }
  };

  const columns: ColumnsType<Invoice> = [
    {
      title: t('invoice:invoiceNumber'),
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      width: 260,
      minWidth: 180,
      sorter: (a, b) => a.invoice_number.localeCompare(b.invoice_number),
      showSorterTooltip: false,
      render: (v: string) => (
        <Space>
          <FileTextOutlined style={{ color: '#1a73e8' }} />
          <Text style={{ fontFamily: 'monospace' }}>{v}</Text>
        </Space>
      ),
    },
    {
      title: t('invoice:period'),
      key: 'period',
      width: 140,
      minWidth: 110,
      sorter: (a, b) => {
        const aValue = a.period_year * 100 + a.period_month;
        const bValue = b.period_year * 100 + b.period_month;
        return aValue - bValue;
      },
      showSorterTooltip: false,
      render: (_: unknown, r: Invoice) =>
        `${r.period_year}-${String(r.period_month).padStart(2, '0')}`,
    },
    {
      title: t('invoice:cloudSpend'),
      dataIndex: 'cloud_cost_total',
      key: 'cloud_cost_total',
      width: 160,
      minWidth: 120,
      align: 'right' as const,
      sorter: (a, b) => a.cloud_cost_total - b.cloud_cost_total,
      showSorterTooltip: false,
      render: (v: number) =>
        `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('invoice:serviceFee'),
      dataIndex: 'costq_fee',
      key: 'costq_fee',
      width: 140,
      minWidth: 110,
      align: 'right' as const,
      sorter: (a, b) => a.costq_fee - b.costq_fee,
      showSorterTooltip: false,
      render: (v: number) =>
        `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      title: t('invoice:status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      minWidth: 90,
      sorter: (a, b) => a.status.localeCompare(b.status),
      showSorterTooltip: false,
      render: () => <Tag color="success">{t('invoice:statusGenerated')}</Tag>,
    },
    {
      title: t('invoice:date'),
      dataIndex: 'generated_at',
      key: 'generated_at',
      width: 150,
      minWidth: 120,
      sorter: (a, b) => {
        const aValue = a.generated_at ? dayjs(a.generated_at).valueOf() : 0;
        const bValue = b.generated_at ? dayjs(b.generated_at).valueOf() : 0;
        return aValue - bValue;
      },
      showSorterTooltip: false,
      render: (v: string) =>
        v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, r: Invoice) => (
        <Tooltip title={t('invoice:download')}>
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(r)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
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

      <Card>
        <Space
          style={{
            marginBottom: 16,
            width: '100%',
            justifyContent: 'space-between',
          }}
        >
          <Text type="secondary">
            {t('common:pagination.total', { total: items.length })}
          </Text>
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={handleRefresh}
            loading={isFetching}
          >
            {t('common:button.refresh')}
          </Button>
        </Space>

        <AWSStyleTable
          tableId="invoice-settings"
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={isLoading}
          pagination={{
            ...paginationProps,
            total: items.length,
            showTotal: (total) => t('common:pagination.total', { total }),
          }}
          locale={{
            emptyText: !isLoading ? (
              <Empty description={t('invoice:noInvoices')} />
            ) : undefined,
          }}
          scroll={{ x: 980 }}
          sticky={{ offsetHeader: 0 }}
        />
      </Card>
    </div>
  );
}
