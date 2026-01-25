// GCP Account Selector - GCP 账号选择组件
import { type FC, useEffect } from 'react';
import { Select, Tag, Space, Spin, Tooltip } from 'antd';
import { GoogleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';

const { Option } = Select;

interface GCPAccountSelectorProps {
  style?: React.CSSProperties;
  placeholder?: string;
}

export const GCPAccountSelector: FC<GCPAccountSelectorProps> = ({
  style,
  placeholder = "选择要查询的 GCP 账号"
}) => {
  const {
    accounts,
    selectedAccountIds,
    loading,
    fetchAccounts,
    setSelectedAccounts
  } = useGCPAccountStore();

  // 组件挂载时获取账号列表
  // ✅ 使用空依赖数组，只在组件挂载时调用一次
  // fetchAccounts 内部已有去重机制，避免重复调用
  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ 空依赖数组，只在挂载时调用一次

  // 清理无效的选中账号（账号已被删除）
  useEffect(() => {
    if (accounts.length > 0 && selectedAccountIds.length > 0) {
      const validAccountIds = accounts.map(acc => acc.id);
      const invalidSelections = selectedAccountIds.filter(
        id => !validAccountIds.includes(id)
      );

      if (invalidSelections.length > 0) {
        // 过滤掉无效的选择
        const validSelections = selectedAccountIds.filter(
          id => validAccountIds.includes(id)
        );
        setSelectedAccounts(validSelections);
      }
    }
  }, [accounts, selectedAccountIds, setSelectedAccounts]);

  // 处理选择变化
  const handleChange = (values: string[]) => {
    setSelectedAccounts(values);
  };

  return (
    <Select
      mode="multiple"
      style={{
        width: '100%',
        ...style
      }}
      placeholder={
        loading ? (
          <Space>
            <Spin size="small" />
            <span>加载账号列表...</span>
          </Space>
        ) : (
          placeholder
        )
      }
      value={selectedAccountIds}
      onChange={handleChange}
      loading={loading}
      maxTagCount={1}
      maxTagPlaceholder={(omittedValues) => (
        <Tooltip title={`已选择 ${selectedAccountIds.length} 个账号`}>
          <Tag>+{omittedValues.length}</Tag>
        </Tooltip>
      )}
      optionLabelProp="label"
      size="middle"
      disabled={loading || accounts.length === 0}
      notFoundContent={
        loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
            <div style={{ marginTop: '8px' }}>加载中...</div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            暂无账号，请先添加 GCP 账号
          </div>
        )
      }
    >
      {accounts.map((account) => (
        <Option
          key={account.id}
          value={account.id}
          label={
            <Space size={4}>
              <GoogleOutlined />
              <span>{account.account_name}</span>
            </Space>
          }
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <GoogleOutlined style={{ color: '#4285f4' }} />
              <span style={{ fontWeight: 500 }}>{account.account_name}</span>
              {account.is_verified && (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              )}
            </Space>
            <Space direction="vertical" size={0} style={{ fontSize: '12px', color: '#999' }}>
              <span>项目: {account.project_id}</span>
              {account.organization_id && (
                <span>组织: {account.organization_id}</span>
              )}
            </Space>
          </div>
        </Option>
      ))}
    </Select>
  );
};
