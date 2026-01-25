// useAccountSelection Hook - 检查账号选择状态
import { useMemo } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useGCPAccountStore } from '../stores/gcpAccountStore';

/**
 * 检查用户是否已选择任意云账号
 * @returns 是否已选择账号
 */
export const useHasSelectedAccount = (): boolean => {
  const { selectedAccountIds: awsIds } = useAccountStore();
  const { selectedAccountIds: gcpIds } = useGCPAccountStore();

  return useMemo(() => {
    return awsIds.length > 0 || gcpIds.length > 0;
  }, [awsIds.length, gcpIds.length]);
};

/**
 * 获取账号选择详情
 */
export const useAccountSelectionDetails = () => {
  const { selectedAccountIds: awsIds, accounts: awsAccounts } = useAccountStore();
  const { selectedAccountIds: gcpIds, accounts: gcpAccounts } = useGCPAccountStore();

  return useMemo(() => {
    const hasAWS = awsIds.length > 0;
    const hasGCP = gcpIds.length > 0;
    const hasAny = hasAWS || hasGCP;

    return {
      hasAWS,
      hasGCP,
      hasAny,
      awsCount: awsIds.length,
      gcpCount: gcpIds.length,
      totalCount: awsIds.length + gcpIds.length,
      hasAWSAccounts: awsAccounts.length > 0,
      hasGCPAccounts: gcpAccounts.length > 0
    };
  }, [awsIds.length, gcpIds.length, awsAccounts.length, gcpAccounts.length]);
};
