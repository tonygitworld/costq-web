import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { WaveBackground } from '@/components/product/components/WaveBackground';
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
      <div className={styles.waveBackground}>
        <WaveBackground />
      </div>
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.content}>
        {children}
      </div>

      {showLanguageSwitcher && (
        <div className={styles.languageSwitcher}>
          <LanguageSwitcher />
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
