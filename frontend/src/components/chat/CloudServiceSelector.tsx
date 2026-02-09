// d:\costq\web\costq-web\frontend\src\components\chat\CloudServiceSelector.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from 'antd';

// 添加旋转动画样式
const spinKeyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// 注入样式到页面
if (typeof document !== 'undefined' && !document.querySelector('#spin-animation')) {
  const style = document.createElement('style');
  style.id = 'spin-animation';
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}
import { Popover } from 'antd';
import CloudIcon from '../icons/CloudIcon';
import AWSLogo from '../icons/AWSLogo';
import GCPLogo from '../icons/GCPLogo';
import CheckmarkIcon from '../icons/CheckmarkIcon';

export interface Account {
  id: string;
  name: string;
  accountId?: string;
  region?: string;
}

interface CloudProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  accounts: Account[];
}

export interface CloudServiceSelectorProps {
  awsAccounts: Account[];
  gcpAccounts: Account[];
  onSelectionChange: (selectedAccountIds: string[]) => void;
  initialSelectedAccountIds?: string[];
  loading?: boolean;
}

type ViewType = 'providers' | 'accounts';

const STORAGE_KEY = 'cloud_service_selected_accounts';

/**
 * 云服务选择器组件 - Popover下拉菜单版本
 *
 * 功能特性：
 * - 顶部弹出下拉菜单
 * - 支持多选AWS和GCP账号
 * - localStorage持久化用户选择
 * - 显示选中数量徽章
 * - 当前选中项显示对勾标记
 */
export const CloudServiceSelector: React.FC<CloudServiceSelectorProps> = ({
  awsAccounts,
  gcpAccounts,
  onSelectionChange,
  initialSelectedAccountIds = [],
  loading = false,
}) => {
  // 从localStorage加载已选择的账号ID
  const loadSelectedAccounts = (): string[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load selected accounts from localStorage:', error);
    }
    return initialSelectedAccountIds;
  };

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(loadSelectedAccounts());
  const [currentView, setCurrentView] = useState<ViewType>('providers');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 保存到localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedAccountIds));
    } catch (error) {
      console.warn('Failed to save selected accounts to localStorage:', error);
    }
  }, [selectedAccountIds]);

  // 通知父组件选择变化
  useEffect(() => {
    onSelectionChange(selectedAccountIds);
  }, [selectedAccountIds, onSelectionChange]);

  // 构建云服务商数据
  const cloudProviders: CloudProvider[] = useMemo(() => [
    {
      id: 'aws',
      name: 'AWS 云服务',
      icon: <AWSLogo size={16} />,
      accounts: awsAccounts || [],
    },
    {
      id: 'gcp',
      name: 'Google Cloud 云服务',
      icon: <GCPLogo size={16} />,
      accounts: gcpAccounts || [],
    },
  ], [awsAccounts, gcpAccounts]);

  const selectedProvider = useMemo(
    () => cloudProviders.find(p => p.id === selectedProviderId),
    [selectedProviderId, cloudProviders]
  );

  // 处理提供商点击
  const handleProviderClick = (providerId: string) => {
    setSelectedProviderId(providerId);
    setCurrentView('accounts');
  };

  // 处理返回提供商列表
  const handleBackClick = () => {
    setCurrentView('providers');
    setSelectedProviderId(null);
    setSearchKeyword(''); // 清空搜索关键词
  };

  // 处理账号点击（切换选中状态）
  const handleAccountClick = (accountId: string) => {
    setSelectedAccountIds(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  };

  // 获取所有选中的账号
  const selectedAccountsCount = selectedAccountIds.length;

  // 渲染触发按钮内容
  const renderTriggerContent = () => {
    // 加载状态：显示加载动画和文本
    if (loading) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'rgba(0, 0, 0, 0.45)',
          fontSize: '13px'
        }}>
          <div style={{
            width: '14px',
            height: '14px',
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #1890ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span>正在加载云服务...</span>
        </div>
      );
    }

    if (selectedAccountsCount === 0) {
      // 未选择：显示默认文本
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'rgba(0, 0, 0, 0.25)',
          fontSize: '13px'
        }}>
          <CloudIcon size="14px" color="rgba(0, 0, 0, 0.45)" />
          <span>选择云服务</span>
        </div>
      );
    }

    // 已选择：显示账号chips（只显示1个 + 剩余数量）
    const allAccounts = [...(awsAccounts || []), ...(gcpAccounts || [])];

    // ✅ 按照用户选择顺序排序账号（先选的在前，后选的在后）
    const selectedAccounts = selectedAccountIds
      .map(id => allAccounts.find(acc => acc.id === id))
      .filter((acc): acc is NonNullable<typeof acc> => acc !== undefined);

    // 只显示1个账号chip，其余显示为 +n
    const displayAccounts = selectedAccounts.slice(0, 1);
    // n = 总选中数 - 1（因为显示了1个）
    const remainingCount = selectedAccounts.length - 1;

    const chips = displayAccounts.map((account) => {
      // ✅ 更可靠的判断方式：直接检查账号是否在 awsAccounts 中
      const isAWS = awsAccounts?.some(acc => acc.id === account.id) ?? false;
      const logo = isAWS ? <AWSLogo size={12} /> : <GCPLogo size={12} />;

      // 智能截断：超过10个字符就截断
      const displayName = account.name.length > 10
        ? account.name.slice(0, 10) + '...'
        : account.name;

      return (
        <span
          key={account.id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '0 4px 0 8px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #f0f0f0',
            borderRadius: '4px',
            fontSize: '13px',
            color: 'rgba(0, 0, 0, 0.88)',
            fontWeight: 400,
            maxWidth: '140px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '22px',
            transition: 'all 0.2s',
            cursor: 'default',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e6e6e6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
          }}
        >
          {logo}
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {displayName}
          </span>
          {/* 关闭按钮 - 点击移除该账号 */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleAccountClick(account.id);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '2px',
              padding: '2px',
              borderRadius: '2px',
              cursor: 'pointer',
              color: 'rgba(0, 0, 0, 0.45)',
              transition: 'all 0.2s',
              fontSize: '10px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ff4d4f';
              e.currentTarget.style.backgroundColor = 'rgba(255, 77, 79, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(0, 0, 0, 0.45)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="移除"
          >
            <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true" style={{ display: 'inline-block' }}>
              <path d="M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z"></path>
            </svg>
          </span>
        </span>
      );
    });

    // 如果有超过1个账号，显示"+n"（n = 总选中数 - 1）
    if (remainingCount > 0) {
      chips.push(
        <span key="more" style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 8px',
          backgroundColor: 'rgba(0, 0, 0, 0.06)',
          border: 'none',
          borderRadius: '4px',
          fontSize: '13px',
          color: 'rgba(0, 0, 0, 0.65)',
          fontWeight: 400,
          lineHeight: '22px',
          transition: 'all 0.2s',
          flexShrink: 0,
        }}>
          +{remainingCount}
        </span>
      );
    }

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: '13px',
        flexWrap: 'nowrap',
        overflow: 'hidden',
        flex: 1,
        minWidth: 0,
      }}>
        {chips}
      </div>
    );
  };

  // 渲染内容
  const renderContent = () => {
    if (currentView === 'providers') {
      // 渲染提供商列表 - 紧凑布局，无多余空白
      return (
        <div style={{ width: '280px', padding: '4px 0' }}>
          {cloudProviders.map((provider) => (
            <div
              key={provider.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                borderRadius: '6px',
                margin: '2px 4px',
              }}
              onClick={() => handleProviderClick(provider.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {provider.icon}
                <span style={{
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#1a1a1a'
                }}>
                  {provider.name}
                </span>
              </div>
              <span style={{ color: '#999', fontSize: '12px' }}>
                {provider.accounts.length} 个账号
              </span>
            </div>
          ))}
        </div>
      );
    } else {
      // 渲染账号列表
      return (
        <div style={{ width: '280px', maxHeight: '320px', display: 'flex', flexDirection: 'column' }}>
          {/* 搜索框和返回按钮 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            {/* 返回按钮 */}
            <button
              onClick={handleBackClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBackClick();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                padding: 0,
                cursor: 'pointer',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                transition: 'background-color 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="返回"
              aria-label="返回云服务列表"
            >
              <svg viewBox="64 64 896 896" width="16px" height="16px" fill="#595959" aria-hidden="true" style={{ display: 'inline-block' }}>
                <path d="M872 572H266.8l144.3-144c13.8-13.8 13.8-36.2 0-50s-36.2-13.8-50 0L146.8 550.4c-13.8 13.8-13.8 36.2 0 50l213.3 213.3c13.8 13.8 36.2 13.8 50 0 13.8-13.8 13.8-36.2 0-50L266.8 620H872c19.4 0 35-15.6 35-35s-15.6-35-35-35z"></path>
              </svg>
            </button>

            {/* 搜索框 - 使用原生 input 避免 Ant Design 焦点样式变化 */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 10px',
                backgroundColor: '#fff',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                fontSize: '13px',
                height: '30px',
              }}
            >
              {/* 搜索图标 */}
              <svg viewBox="64 64 896 896" width="14px" height="14px" fill="#bfbfbf" aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0 }}>
                <path d="M909.6 854.5L649.9 594.8C690.2 542.7 712 479 712 412c0-80.2-31.3-155.4-87.9-212.1-56.6-56.7-132-87.9-212.1-87.9s-155.5 31.3-212.1 87.9C143.2 256.5 112 331.8 112 412c0 80.1 31.3 155.5 87.9 212.1C256.5 680.8 331.8 712 412 712c67 0 130.6-21.8 182.8-62l259.7 259.6a8.2 8.2 0 0011.6 0l43.6-43.5a8.2 8.2 0 000-11.6zM570.4 570.4C528 612.7 471.8 636 412 636s-116-23.3-158.4-65.6C211.3 528 188 471.8 188 412s23.3-116.1 65.6-158.4C296 211.3 352.2 188 412 188s116.1 23.2 158.4 65.6S636 352.2 636 412s-23.3 116.1-65.6 158.4z"></path>
              </svg>
              {/* 输入框 */}
              <input
                type="text"
                placeholder="搜索云服务"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  padding: 0,
                  margin: 0,
                }}
              />
              {/* 清空按钮 */}
              {searchKeyword && (
                <div
                  onClick={() => setSearchKeyword('')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <svg viewBox="64 64 896 896" width="14px" height="14px" fill="#bfbfbf" aria-hidden="true" style={{ display: 'inline-block' }}>
                    <path d="M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z"></path>
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* 账号列表 - 自适应高度 */}
          <div style={{ overflowY: 'auto', padding: '4px 0' }}>
            {!selectedProvider?.accounts || selectedProvider.accounts.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                暂无可用账号
              </div>
            ) : (
              (() => {
                // 根据搜索关键词过滤账号
                const filteredAccounts = searchKeyword.trim()
                  ? selectedProvider.accounts.filter(account =>
                      account.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                      (account.accountId && account.accountId.toLowerCase().includes(searchKeyword.toLowerCase())) ||
                      account.id.toLowerCase().includes(searchKeyword.toLowerCase())
                    )
                  : selectedProvider.accounts;

                if (filteredAccounts.length === 0) {
                  return (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                      未找到匹配的账号
                    </div>
                  );
                }

                return filteredAccounts.map((account) => {
                const isSelected = selectedAccountIds.includes(account.id);
                return (
                  <div
                    key={account.id}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                      borderRadius: '6px',
                      margin: '2px 4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => handleAccountClick(account.id)}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <CloudIcon style={{ width: '14px', height: '14px', color: '#1890ff' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: 500,
                          fontSize: '13px',
                          color: '#1a1a1a',
                          marginBottom: '2px'
                        }}>
                          {account.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#999' }}>
                          {/* ✅ 使用 selectedProvider.id 判断，更可靠 */}
                          {(() => {
                            const isAWS = selectedProvider?.id === 'aws';

                            if (isAWS) {
                              // AWS: 显示账号ID和区域
                              return (
                                <>
                                  {account.accountId || account.id}
                                  {account.region && <span> · {account.region}</span>}
                                </>
                              );
                            } else {
                              // GCP: 显示项目ID和服务账号
                              return (
                                <>
                                  <span style={{ color: '#4285F4', fontWeight: 500 }}>项目:</span> {account.accountId || account.id}
                                  {account.region && <span> · {account.region}</span>}
                                </>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckmarkIcon style={{ width: '14px', height: '14px', color: '#52c41a' }} />
                    )}
                  </div>
                );
              });
              })()
            )}
          </div>
        </div>
      );
    }
  };

  return (
    <Popover
      content={renderContent()}
      trigger="click"
      open={isPopoverOpen && !loading}
      onOpenChange={(visible) => {
        if (loading) return; // 加载时不允许操作
        setIsPopoverOpen(visible);
        if (!visible) {
          // 关闭时重置视图
          setCurrentView('providers');
          setSelectedProviderId(null);
          setSearchKeyword(''); // 清空搜索关键词
        }
      }}
      placement="top"
      arrow={false}
      overlayStyle={{ padding: 0 }}
      styles={{
        container: {
          padding: '8px 0',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)'
        }
      }}
    >
      {/* 触发按钮 */}
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '180px',              // 固定宽度
          height: '32px',
          backgroundColor: loading ? '#f5f5f5' : '#ffffff',
          border: `1px solid ${loading ? '#e0e0e0' : '#d9d9d9'}`,
          borderRadius: '6px',
          padding: '0 8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 2px 0 rgba(0, 0, 0, 0.02)',
          flexShrink: 0,             // 防止被压缩
          opacity: loading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = '#4096ff';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(5, 145, 255, 0.06)';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = '#d9d9d9';
            e.currentTarget.style.boxShadow = '0 2px 0 rgba(0, 0, 0, 0.02)';
          }
        }}
        title={loading ? "正在加载云服务..." : "选择云服务"}
      >
        {renderTriggerContent()}

        {/* 下拉箭头 - 使用 Ant Design 样式 */}
        <span style={{
          marginLeft: '4px',
          color: 'rgba(0, 0, 0, 0.25)',
          fontSize: '12px',
          transition: 'transform 0.3s',
          transform: isPopoverOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          display: 'inline-flex',
          alignItems: 'center',
        }}>
          <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor" aria-hidden="true">
            <path d="M884 256h-75c-5.1 0-9.9 2.5-12.9 6.6L512 654.2 227.9 262.6c-3-4.1-7.8-6.6-12.9-6.6h-75c-6.5 0-10.3 7.4-6.5 12.7l352.6 486.1c12.8 17.6 39 17.6 51.7 0l352.6-486.1c3.9-5.3.1-12.7-6.4-12.7z"></path>
          </svg>
        </span>
      </div>
    </Popover>
  );
};

export default CloudServiceSelector;
