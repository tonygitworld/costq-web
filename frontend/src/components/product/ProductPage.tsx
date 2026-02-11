import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
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
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
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
