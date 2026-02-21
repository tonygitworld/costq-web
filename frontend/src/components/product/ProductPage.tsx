import React, { useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
// Phase 1: Core ToB Sections
import { ProblemSection } from './components/ProblemSection';
import { ProductShowcaseSection } from './components/ProductShowcaseSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { ProductRoadmapSection } from './components/ProductRoadmapSection';
import { FinalCTASection } from './components/FinalCTASection';
import styles from './ProductPage.module.css';

const ProductPage: React.FC = () => {
  useEffect(() => {
    const fontHref = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    // 防止重复加载
    if (document.querySelector(`link[href="${fontHref}"]`)) return;
    const link = document.createElement('link');
    link.href = fontHref;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // 监听 hash 变化并滚动到对应 section
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        const element = document.getElementById(hash);
        if (element) {
          const container = document.getElementById('product-page-container');
          if (container) {
            // 直接使用 element.offsetTop，它已经是相对于容器的位置
            const elementTop = element.offsetTop;
            container.scrollTo({ top: elementTop, behavior: 'smooth' });
          }
        }
      }
    };

    handleHashChange(); // 初始检查
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
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

        {/* 5. How It Works - 工作原理 */}
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
