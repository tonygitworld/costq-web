import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Modal } from 'antd';
import {
  ArrowLeftOutlined,
  CloudOutlined,
  TeamOutlined,
  ControlOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  UserOutlined,
  GlobalOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { useI18n } from '../../hooks/useI18n';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import './MobileSettingsPage.css';

export interface MobileSettingsPageProps {
  visible: boolean;
  onClose: () => void;
}

export const MobileSettingsPage: FC<MobileSettingsPageProps> = ({ visible, onClose }) => {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(state => state.isAdmin);
  const isSuperAdmin = useAuthStore(state => state.isSuperAdmin);
  const logout = useAuthStore(state => state.logout);
  const { t } = useI18n(['chat', 'common']);

  const awsAccounts = useAccountStore(state => state.accounts);
  const gcpAccounts = useGCPAccountStore(state => state.accounts);
  const totalAccounts = awsAccounts.length + gcpAccounts.length;

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleLogout = () => {
    Modal.confirm({
      title: t('chat:sidebar.logout'),
      content: t('chat:sidebar.logoutConfirm'),
      okText: t('chat:sidebar.logoutButton'),
      cancelText: t('common:button.cancel'),
      okButtonProps: { danger: true },
      centered: true,
      onOk: () => {
        logout();
        onClose();
      },
    });
  };

  return (
    <div className={`mobile-settings-page${visible ? ' mobile-settings-visible' : ''}`}>
      {/* 顶部导航栏 */}
      <div className="mobile-settings-header">
        <button
          className="mobile-settings-back-btn"
          onClick={onClose}
          aria-label="返回"
        >
          <ArrowLeftOutlined style={{ fontSize: '18px' }} />
        </button>
        <span className="mobile-settings-title">{t('chat:sidebar.settings')}</span>
      </div>

      {/* 菜单内容区域 */}
      <div className="mobile-settings-content">
        {/* 个人设置分组 */}
        <div className="mobile-settings-group">
          <div className="mobile-settings-group-title">{t('chat:sidebar.personalSettings')}</div>

          {/* 个人资料 */}
          <button
            className="mobile-settings-item"
            onClick={() => handleNavigate('/settings/profile')}
          >
            <div className="mobile-settings-item-icon"><UserOutlined /></div>
            <div className="mobile-settings-item-content">
              <span className="mobile-settings-item-label">{t('chat:sidebar.personalProfile')}</span>
            </div>
          </button>

          {/* 修改密码 */}
          <button
            className="mobile-settings-item"
            onClick={() => handleNavigate('/settings/password')}
          >
            <div className="mobile-settings-item-icon"><ControlOutlined /></div>
            <div className="mobile-settings-item-content">
              <span className="mobile-settings-item-label">{t('chat:sidebar.changePassword')}</span>
            </div>
          </button>

          {/* 退出登录 */}
          <button
            className="mobile-settings-item"
            onClick={handleLogout}
          >
            <div className="mobile-settings-item-icon"><LogoutOutlined /></div>
            <div className="mobile-settings-item-content">
              <span className="mobile-settings-item-label">{t('chat:sidebar.logout')}</span>
            </div>
          </button>
        </div>

        <div className="mobile-settings-divider" />

        {/* 系统设置分组 */}
        <div className="mobile-settings-group">
          <div className="mobile-settings-group-title">{t('chat:sidebar.systemSettings')}</div>

          {/* 语言设置 - 内联 LanguageSwitcher */}
          <div className="mobile-settings-item-static">
            <div className="mobile-settings-item-icon"><GlobalOutlined /></div>
            <div className="mobile-settings-item-content">
              <span className="mobile-settings-item-label">{t('chat:sidebar.languageSettings')}</span>
              <div onClick={(e) => e.stopPropagation()}>
                <LanguageSwitcher showIcon={false} showText={true} type="dropdown" />
              </div>
            </div>
          </div>
        </div>

        {/* 管理设置分组 - 仅管理员 */}
        {isAdmin() && (
          <>
            <div className="mobile-settings-divider" />
            <div className="mobile-settings-group">
              <div className="mobile-settings-group-title">{t('chat:sidebar.managementSettings')}</div>

              {/* 云账号管理 */}
              <button
                className="mobile-settings-item"
                onClick={() => handleNavigate('/settings/accounts')}
              >
                <div className="mobile-settings-item-icon"><CloudOutlined /></div>
                <div className="mobile-settings-item-content">
                  <span className="mobile-settings-item-label">{t('chat:sidebar.cloudAccounts')}</span>
                  {totalAccounts > 0 && (
                    <Badge
                      count={totalAccounts}
                      className="mobile-settings-item-badge"
                      style={{ backgroundColor: '#52c41a' }}
                    />
                  )}
                </div>
              </button>

              {/* 用户管理 */}
              <button
                className="mobile-settings-item"
                onClick={() => handleNavigate('/settings/users')}
              >
                <div className="mobile-settings-item-icon"><TeamOutlined /></div>
                <div className="mobile-settings-item-content">
                  <span className="mobile-settings-item-label">{t('chat:sidebar.userManagement')}</span>
                </div>
              </button>
            </div>
          </>
        )}

        {/* 运营后台分组 - 仅超级管理员 */}
        {isSuperAdmin() && (
          <>
            <div className="mobile-settings-divider" />
            <div className="mobile-settings-group">
              <div className="mobile-settings-group-title">{t('chat:sidebar.opsBackend')}</div>

              {/* 运营 Dashboard */}
              <button
                className="mobile-settings-item"
                onClick={() => handleNavigate('/ops/dashboard')}
              >
                <div className="mobile-settings-item-icon"><DashboardOutlined /></div>
                <div className="mobile-settings-item-content">
                  <span className="mobile-settings-item-label">{t('chat:sidebar.opsDashboard')}</span>
                </div>
              </button>

              {/* 租户管理 */}
              <button
                className="mobile-settings-item"
                onClick={() => handleNavigate('/ops/tenants')}
              >
                <div className="mobile-settings-item-icon"><TeamOutlined /></div>
                <div className="mobile-settings-item-content">
                  <span className="mobile-settings-item-label">{t('chat:sidebar.tenantManagement')}</span>
                </div>
              </button>

              {/* 审计日志 */}
              <button
                className="mobile-settings-item"
                onClick={() => handleNavigate('/ops/audit-logs')}
              >
                <div className="mobile-settings-item-icon"><FileSearchOutlined /></div>
                <div className="mobile-settings-item-content">
                  <span className="mobile-settings-item-label">{t('chat:sidebar.auditLogs')}</span>
                </div>
              </button>

              {/* Token 用量 */}
              <button
                className="mobile-settings-item"
                onClick={() => handleNavigate('/ops/token-usage')}
              >
                <div className="mobile-settings-item-icon"><BarChartOutlined /></div>
                <div className="mobile-settings-item-content">
                  <span className="mobile-settings-item-label">{t('chat:sidebar.tokenUsage')}</span>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
