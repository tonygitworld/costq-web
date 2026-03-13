import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import { MobileSettingsPage } from '../layout/MobileSettingsPage';

export const SettingsHome: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  // 手机端：显示 MobileSettingsPage
  if (isMobile) {
    return (
      <MobileSettingsPage
        visible={true}
        onClose={() => navigate('/')}
      />
    );
  }

  // 桌面端：重定向到第一个设置页面或显示菜单
  React.useEffect(() => {
    navigate('/settings/profile', { replace: true });
  }, [navigate]);

  return null;
};
