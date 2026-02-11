import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import styles from './HeroSection.module.css';

export const HeroSection: React.FC = () => {
  const { t } = useI18n();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const letters = [
    { char: 'C', label: t('product:hero.keywords.c'), color: '#3B82F6' },
    { char: 'o', label: t('product:hero.keywords.o'), color: '#8B5CF6' },
    { char: 's', label: t('product:hero.keywords.s'), color: '#EC4899' },
    { char: 't', label: t('product:hero.keywords.t'), color: '#F59E0B' },
    { char: 'Q', label: t('product:hero.keywords.q'), color: '#10B981' },
  ];

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const { currentTarget, clientX, clientY } = e;
    const { left, top } = currentTarget.getBoundingClientRect();
    const x = clientX - left;
    const y = clientY - top;
    currentTarget.style.setProperty('--mouse-x', `${x}px`);
    currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <section id="hero" className={styles.hero} onMouseMove={handleMouseMove}>
      <div className={styles.container}>
        <div className={styles.centerVisual}>
          <div className={styles.wordWrapper}>
            {letters.map((item, index) => (
              <motion.span
                key={index}
                className={styles.letter}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  '--hover-color': item.color,
                  display: 'inline-block',
                  marginRight: index === letters.length - 1 ? '0px' : '20px'
                } as React.CSSProperties}
              >
                {item.char}
              </motion.span>
            ))}
          </div>

          {/* 动态关键词展示区 */}
          <div className={styles.keywordContainer}>
            <AnimatePresence mode="wait">
              {hoveredIndex !== null && (
                <motion.div
                  key={hoveredIndex}
                  className={styles.keyword}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  style={{ color: letters[hoveredIndex].color }}
                >
                  {letters[hoveredIndex].label}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tagline - 分两行显示 */}
          <div className={styles.tagline}>
            <h2 className={styles.taglineTitle}>
              {t('product:hero.subtitle').split('\n').map((line, i) => (
                <span
                  key={i}
                  style={{
                    display: 'block',
                    color: i === 1 ? '#64748B' : undefined, // 第二行灰色
                    fontSize: i === 1 ? '0.85em' : undefined, // 第二行稍小
                    fontWeight: i === 1 ? 400 : undefined, // 第二行标准字重
                    marginTop: i > 0 ? '12px' : '0'
                  }}
                >
                  {line}
                </span>
              ))}
            </h2>
          </div>

          {/* CTA Buttons - 交换位置 */}
          <div className={styles.ctaGroup}>
            <a href="#product-showcase" className={styles.secondaryBtn}>
              {t('product:hero.ctaSecondary')}
            </a>
            <Link to="/login" className={styles.primaryBtn}>
              {t('product:hero.ctaPrimary')}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
