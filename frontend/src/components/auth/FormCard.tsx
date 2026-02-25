import React from 'react';
import styles from './FormCard.module.css';

interface FormCardProps {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}

export const FormCard: React.FC<FormCardProps> = ({
  children,
  className,
  wide = false,
}) => {
  return (
    <div className={`${styles.card}${wide ? ` ${styles.cardWide}` : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
};
