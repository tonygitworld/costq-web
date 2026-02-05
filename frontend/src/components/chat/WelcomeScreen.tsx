import React, { useMemo, useState, useEffect } from 'react';
import { useAccountStore } from '../../stores/accountStore';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';
import { useI18n } from '../../hooks/useI18n';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
  onConfigureAws?: () => void;
  onConfigureGcp?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onConfigureAws,
  onConfigureGcp
}) => {
  // 获取账号和加载状态
  const { accounts: awsAccounts, loading: awsLoading } = useAccountStore();
  const { accounts: gcpAccounts, loading: gcpLoading } = useGCPAccountStore();
  const { isZhCN } = useI18n();

  // ✅ 防止 FOUC (Flash of Unstyled Content):
  // 组件挂载初期，Store 的 loading 状态可能还没来得及变 true。
  // 我们给 200ms 的缓冲期，在此期间假定正在加载，显示问候语，防止"去配置"按钮闪现。
  const [isMounting, setIsMounting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounting(false), 200);
    return () => clearTimeout(timer);
  }, []);

  // 判断是否有账号
  const hasAccountsData = awsAccounts.length > 0 || gcpAccounts.length > 0;
  // 判断是否正在加载
  const isLoading = awsLoading || gcpLoading;

  // ✅ 核心优化：
  // 1. 挂载缓冲期 OR 正在加载 OR 已经有账号 -> 显示"已就绪" (问候语)
  // 2. 只有当 (缓冲期结束 AND 加载完成 AND 确实没有账号) -> 显示"配置引导"
  const showReadyState = isMounting || isLoading || hasAccountsData;

  // 问候语
  const greeting = useMemo(() => {
    if (isZhCN()) {
      return "今天有什么可以帮您？";
    }
    return "How can I help you today?";
  }, [isZhCN]);

  return (
    <div className="welcome-screen-container">
      {/* 图标与文字 */}
      <div className="welcome-header-row">
        <div className="welcome-icon-pure">
          ☁️
        </div>

        <h1 className="welcome-title-serif">
          {showReadyState ? (
            <>{greeting}</>
          ) : (
            isZhCN() ? "欢迎使用 CostQ" : "Welcome to CostQ"
          )}
        </h1>
      </div>

      {/* 配置引导：仅在加载完成且无账号时显示 */}
      {!showReadyState && (
        <div className="welcome-actions-minimal">
          <button className="pill-btn" onClick={onConfigureAws}>
             {isZhCN() ? "连接 AWS 账号" : "Connect AWS"}
          </button>
          <button className="pill-btn" onClick={onConfigureGcp}>
             {isZhCN() ? "连接 GCP 账号" : "Connect GCP"}
          </button>
        </div>
      )}
    </div>
  );
};
