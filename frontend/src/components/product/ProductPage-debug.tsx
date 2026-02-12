import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
// Phase 1: Core ToB Sections
import { ProblemSection } from './components/ProblemSection';
import { ProductShowcaseSection } from './components/ProductShowcaseSection';
import { BenefitsSection } from './components/BenefitsSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { ProductRoadmapSection } from './components/ProductRoadmapSection';
import { FinalCTASection } from './components/FinalCTASection';
import styles from './ProductPage.module.css';

const ProductPage: React.FC = () => {
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // 监听 hash 变化并滚动到对应 section (调试版)
  useEffect(() => {
    const handleHashChange = () => {
      console.log('[ProductPage] hash changed to:', window.location.hash);
      const hash = window.location.hash.replace('#', '');
      console.log('[ProductPage] looking for element:', hash);
      if (hash) {
        const element = document.getElementById(hash);
        console.log('[ProductPage] element found:', element);
        if (element) {
          const container = document.getElementById('product-page-container');
          console.log('[ProductPage] container found:', container);
          if (container) {
            const elementTop = element.offsetTop - container.scrollTop;
            console.log('[ProductPage] scrolling to top:', elementTop);
            container.scrollTo({ top: elementTop, behavior: 'smooth' });
            console.log('[ProductPage] scroll done');
          }
        }
      }
    };

    handleHashChange(); // 初始检查
    window.addEventListener('hashchange', handleHashChange);
    console.log('[ProductPage] hash listener registered');
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      console.log('[ProductPage] hash listener cleanup');
    };
  }, []);

  return (
    <div className={styles.page} id="product-page-container">
      <Navbar />
      <main>
        {/* 1. Hero Section - 首屏 */}
        <HeroSection />

        {/* 2. Problem Section - 用户痛点 */}
        <ProblemSection />

        {/* 4. Product Showcase - 产品功能展示 */}
        <ProductShowcaseSection />

        {/* 5. Benefits Section - 核心能力 */}
        <BenefitsSection />

        {/* 6. How It Works - 工作原理 */}
        <HowItWorksSection />

        {/* 7. Product Roadmap - 产品规划 (独立展示) */}
        <ProductRoadmapSection />

        {/* 8. Final CTA - 极简转化 */}
        <FinalCTASection />
      </main>
    </div>
  );
};

export default ProductPage;
