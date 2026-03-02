import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: React.ReactNode;
  showLanguageSwitcher?: boolean;
  showBackButton?: boolean;
  backTo?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  showLanguageSwitcher = true,
  showBackButton = true,
  backTo = '/',
}) => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.content}>
        {children}
      </div>

      {showLanguageSwitcher && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            padding: '6px 12px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}>
            <LanguageSwitcher showIcon={false} showText={true} />
          </div>
        </div>
      )}

      {showBackButton && (
        <button
          className={styles.backButton}
          onClick={() => navigate(backTo)}
          aria-label="Back"
          type="button"
        >
          <ArrowLeft size={20} />
        </button>
      )}
    </div>
  );
};
