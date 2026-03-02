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
  onBack?: () => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  showLanguageSwitcher = true,
  showBackButton = true,
  backTo = '/',
  onBack,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(backTo);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.content}>
        {children}
      </div>

      {showLanguageSwitcher && (
        <div className={styles.languageSwitcherWrapper}>
          <div className={styles.languageSwitcherCard}>
            <LanguageSwitcher showIcon={false} showText={true} />
          </div>
        </div>
      )}

      {showBackButton && (
        <button
          className={styles.backButton}
          onClick={handleBack}
          aria-label="Back"
          type="button"
        >
          <ArrowLeft size={20} />
        </button>
      )}
    </div>
  );
};
