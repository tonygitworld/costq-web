import { type FC, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Badge, Modal } from 'antd';
import {
  CloudOutlined,
  SettingOutlined,
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
import '../styles/SettingsMenu.css';

interface SettingsMenuProps {
  isCollapsed?: boolean;
}

export const SettingsMenu: FC<SettingsMenuProps> = ({ isCollapsed = false }) => {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(state => state.isAdmin);
  const isSuperAdmin = useAuthStore(state => state.isSuperAdmin);
  const logout = useAuthStore(state => state.logout);
  const { t } = useI18n(['chat', 'common']);

  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ bottom: 0, left: 0 });

  // 获取账号数量
  const awsAccounts = useAccountStore(state => state.accounts);
  const gcpAccounts = useGCPAccountStore(state => state.accounts);
  const totalAccounts = awsAccounts.length + gcpAccounts.length;

  // 更新位置
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      setPosition({
        bottom: viewportHeight - rect.bottom,
        left: rect.right + 12,
      });
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
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
        setIsOpen(false);
      }
    });
  };

  const toggleMenu = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isTrigger = triggerRef.current?.contains(target);
      const isDropdown = dropdownRef.current?.contains(target);

      if (!isTrigger && !isDropdown) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      updatePosition();
      // 延迟添加事件监听，避免事件冒泡立即触发
      const timer = setTimeout(() => {
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Portal 内容
  const dropdownContent = (
    <div
      className="settings-menu-dropdown"
      ref={dropdownRef}
      style={{
        position: 'fixed',
        bottom: position.bottom,
        left: position.left,
        margin: 0,
        transformOrigin: 'bottom left',
      }}
    >
      {/* 个人设置分组 */}
      <div className="settings-menu-group">
        <div className="settings-menu-group-title">{t('chat:sidebar.personalSettings')}</div>
        <div className="settings-menu-items">
          {/* 个人资料 */}
          <div
            className="settings-menu-item"
            onClick={() => handleNavigate('/settings/profile')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleNavigate('/settings/profile');
              }
            }}
          >
            <div className="settings-menu-item-icon">
              <UserOutlined />
            </div>
            <div className="settings-menu-item-content">
              <span className="settings-menu-item-label">{t('chat:sidebar.personalProfile')}</span>
            </div>
          </div>

          {/* 修改密码 */}
          <div
            className="settings-menu-item"
            onClick={() => handleNavigate('/settings/password')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleNavigate('/settings/password');
              }
            }}
          >
            <div className="settings-menu-item-icon">
              <ControlOutlined />
            </div>
            <div className="settings-menu-item-content">
              <span className="settings-menu-item-label">{t('chat:sidebar.changePassword')}</span>
            </div>
          </div>

          {/* 退出登录 */}
          <div
            className="settings-menu-item"
            onClick={handleLogout}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleLogout();
              }
            }}
          >
            <div className="settings-menu-item-icon">
              <LogoutOutlined />
            </div>
            <div className="settings-menu-item-content">
              <span className="settings-menu-item-label">{t('chat:sidebar.logout')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="settings-menu-divider" />

      {/* 系统设置分组 */}
      <div className="settings-menu-group">
        <div className="settings-menu-group-title">{t('chat:sidebar.systemSettings')}</div>
        <div className="settings-menu-items">
          {/* 语言设置 */}
          <div className="settings-menu-item-static">
            <div className="settings-menu-item-icon">
              <GlobalOutlined />
            </div>
            <div className="settings-menu-item-content">
              <span className="settings-menu-item-label">{t('chat:sidebar.languageSettings')}</span>
              <div
                style={{ marginLeft: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                <LanguageSwitcher />
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* 分隔线 - 仅管理员 */}
      {isAdmin() && <div className="settings-menu-divider" />}

      {/* 管理设置分组 - 仅管理员 */}
      {isAdmin() && (
        <div className="settings-menu-group">
          <div className="settings-menu-group-title">{t('chat:sidebar.managementSettings')}</div>
          <div className="settings-menu-items">
            {/* 云账号管理 */}
            <div
              className="settings-menu-item"
              onClick={() => handleNavigate('/settings/accounts')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleNavigate('/settings/accounts');
                }
              }}
            >
              <div className="settings-menu-item-icon">
                <CloudOutlined />
              </div>
              <div className="settings-menu-item-content">
                <span className="settings-menu-item-label">{t('chat:sidebar.cloudAccounts')}</span>
                {totalAccounts > 0 && (
                  <Badge
                    count={totalAccounts}
                    className="settings-menu-item-badge"
                    style={{ backgroundColor: '#52c41a' }}
                  />
                )}
              </div>
            </div>

            {/* 用户管理 */}
            <div
              className="settings-menu-item"
              onClick={() => handleNavigate('/settings/users')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleNavigate('/settings/users');
                }
              }}
            >
              <div className="settings-menu-item-icon">
                <TeamOutlined />
              </div>
              <div className="settings-menu-item-content">
                <span className="settings-menu-item-label">{t('chat:sidebar.userManagement')}</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 分隔线 */}
      <div className="settings-menu-divider" />



      {/* 运营后台菜单 - 仅超级管理员 */}
      {isSuperAdmin() && (
        <div className="settings-menu-group">
          <div className="settings-menu-group-title">{t('chat:sidebar.opsBackend')}</div>
          <div className="settings-menu-items">
            {/* 运营 Dashboard */}
            <div
              className="settings-menu-item"
              onClick={() => handleNavigate('/ops/dashboard')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleNavigate('/ops/dashboard');
                }
              }}
            >
              <div className="settings-menu-item-icon">
                <DashboardOutlined />
              </div>
              <div className="settings-menu-item-content">
                <span className="settings-menu-item-label">{t('chat:sidebar.opsDashboard')}</span>
              </div>
            </div>

            {/* 租户管理 */}
            <div
              className="settings-menu-item"
              onClick={() => handleNavigate('/ops/tenants')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleNavigate('/ops/tenants');
                }
              }}
            >
              <div className="settings-menu-item-icon">
                <TeamOutlined />
              </div>
              <div className="settings-menu-item-content">
                <span className="settings-menu-item-label">{t('chat:sidebar.tenantManagement')}</span>
              </div>
            </div>

            {/* 审计日志 */}
            <div
              className="settings-menu-item"
              onClick={() => handleNavigate('/ops/audit-logs')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleNavigate('/ops/audit-logs');
                }
              }}
            >
              <div className="settings-menu-item-icon">
                <FileSearchOutlined />
              </div>
              <div className="settings-menu-item-content">
                <span className="settings-menu-item-label">{t('chat:sidebar.auditLogs')}</span>
              </div>
            </div>

            {/* Token 用量 */}
            <div
              className="settings-menu-item"
              onClick={() => handleNavigate('/ops/token-usage')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleNavigate('/ops/token-usage');
                }
              }}
            >
              <div className="settings-menu-item-icon">
                <BarChartOutlined />
              </div>
              <div className="settings-menu-item-content">
                <span className="settings-menu-item-label">{t('chat:sidebar.tokenUsage')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 渲染逻辑
  if (isCollapsed) {
    return (
      <>
        <button
          className="sidebar-settings-icon"
          ref={triggerRef}
          onClick={toggleMenu}
          aria-expanded={isOpen}
          title={t('chat:sidebar.settings')}
        >
          <SettingOutlined style={{ fontSize: '20px' }} />
        </button>
        {isOpen && createPortal(dropdownContent, document.body)}
      </>
    );
  }

  return (
    <div className="settings-menu-container">
      {/* 设置菜单触发按钮 */}
      <button
        className="settings-menu-trigger"
        ref={triggerRef}
        onClick={toggleMenu}
        aria-expanded={isOpen}
        title={t('chat:sidebar.settings')}
      >
        <SettingOutlined className="settings-menu-trigger-icon" />
        <span>{t('chat:sidebar.settings')}</span>
      </button>

      {/* 使用 Portal 渲染下拉菜单到 body */}
      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  );
};
