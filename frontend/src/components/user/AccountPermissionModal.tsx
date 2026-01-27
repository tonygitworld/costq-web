import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Transfer, message, Spin } from 'antd';
import type { Key } from 'react';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { useI18n } from '../../hooks/useI18n';
import { apiClient } from '../../services/apiClient';

interface AccountPermissionModalProps {
  visible: boolean;
  userId: string;
  onCancel: () => void;
}

export const AccountPermissionModal: React.FC<AccountPermissionModalProps> = ({
  visible,
  userId,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState('aws');
  const [awsTargetKeys, setAwsTargetKeys] = useState<string[]>([]);
  const [gcpTargetKeys, setGcpTargetKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t } = useI18n(['account', 'common']);

  const awsAccounts = useAccountStore(state => state.accounts);
  const gcpAccounts = useGCPAccountStore(state => state.accounts);

  // 加载用户的云账号授权
  useEffect(() => {
    if (visible && userId) {
      loadUserPermissions();
    }
  }, [visible, userId]);

  const loadUserPermissions = async () => {
    setLoading(true);
    try {
      // ✅ 使用 apiClient，自动处理 Token 刷新和 401 错误
      const [awsData, gcpData] = await Promise.all([
        apiClient.get<string[]>(`/users/${userId}/aws-accounts`).catch(() => []),
        apiClient.get<string[]>(`/users/${userId}/gcp-accounts`).catch(() => [])
      ]);

      setAwsTargetKeys(awsData);
      setGcpTargetKeys(gcpData);
    } catch {
      message.error(t('permission.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAwsChange = (newTargetKeys: Key[]) => {
    setAwsTargetKeys(newTargetKeys as string[]);
  };

  const handleGcpChange = (newTargetKeys: Key[]) => {
    setGcpTargetKeys(newTargetKeys as string[]);
  };

  const handleOk = async () => {
    setSaving(true);
    try {
      // ✅ 使用 apiClient，自动处理 Token 刷新和 401 错误
      // 先获取当前授权状态
      const [currentAwsAccounts, currentGcpAccounts] = await Promise.all([
        apiClient.get<string[]>(`/users/${userId}/aws-accounts`).catch(() => [] as string[]),
        apiClient.get<string[]>(`/users/${userId}/gcp-accounts`).catch(() => [] as string[])
      ]);

      // 计算需要添加和删除的AWS账号
      const awsToAdd = awsTargetKeys.filter(id => !currentAwsAccounts.includes(id));
      const awsToRemove = currentAwsAccounts.filter((id: string) => !awsTargetKeys.includes(id));

      // 计算需要添加和删除的GCP账号
      const gcpToAdd = gcpTargetKeys.filter(id => !currentGcpAccounts.includes(id));
      const gcpToRemove = currentGcpAccounts.filter((id: string) => !gcpTargetKeys.includes(id));

      // 执行AWS授权操作
      if (awsToAdd.length > 0) {
        await apiClient.post(`/users/${userId}/aws-accounts`, { account_ids: awsToAdd });
      }

      // 执行AWS撤销操作
      await Promise.all(
        awsToRemove.map(accountId =>
          apiClient.delete(`/users/${userId}/aws-accounts/${accountId}`)
        )
      );

      // 执行GCP授权操作
      if (gcpToAdd.length > 0) {
        await apiClient.post(`/users/${userId}/gcp-accounts`, { account_ids: gcpToAdd });
      }

      // 执行GCP撤销操作
      await Promise.all(
        gcpToRemove.map(accountId =>
          apiClient.delete(`/users/${userId}/gcp-accounts/${accountId}`)
        )
      );

      message.success(t('permission.saveSuccess'));
      onCancel();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('permission.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // AWS账号数据源
  const awsDataSource = awsAccounts.map(account => ({
    key: account.id,
    title: `${account.alias} (${account.account_id || 'N/A'})`,
    description: `区域: ${account.region}`,
  }));

  // GCP账号数据源
  const gcpDataSource = gcpAccounts.map(account => ({
    key: account.id,
    title: account.account_name,
    description: account.project_id,
  }));

  return (
    <Modal
      title={t('permission.title')}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      width={800}
      confirmLoading={saving}
      okText={t('common:button.save')}
      cancelText={t('common:button.cancel')}
    >
      <Spin spinning={loading}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'aws',
              label: `${t('permission.awsTitle')} (${awsTargetKeys.length}/${awsAccounts.length})`,
              children: (
                <Transfer
                  dataSource={awsDataSource}
                  titles={[t('permission.unauthorized'), t('permission.authorized')]}
                  targetKeys={awsTargetKeys}
                  onChange={handleAwsChange}
                  render={item => item.title}
                  listStyle={{
                    width: 320,
                    height: 400,
                  }}
                  showSearch
                  filterOption={(inputValue, item) =>
                    item.title.toLowerCase().includes(inputValue.toLowerCase())
                  }
                />
              ),
            },
            {
              key: 'gcp',
              label: `${t('permission.gcpTitle')} (${gcpTargetKeys.length}/${gcpAccounts.length})`,
              children: (
                <Transfer
                  dataSource={gcpDataSource}
                  titles={[t('permission.unauthorized'), t('permission.authorized')]}
                  targetKeys={gcpTargetKeys}
                  onChange={handleGcpChange}
                  render={item => item.title}
                  listStyle={{
                    width: 320,
                    height: 400,
                  }}
                  showSearch
                  filterOption={(inputValue, item) =>
                    item.title.toLowerCase().includes(inputValue.toLowerCase())
                  }
                />
              ),
            },
          ]}
        />
      </Spin>
    </Modal>
  );
};
