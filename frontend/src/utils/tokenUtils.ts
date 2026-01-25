/**
 * Token 工具函数
 * 
 * 用于检查和管理 JWT Token
 */

/**
 * 检测JWT Token是否过期
 * @param token JWT Token
 * @returns true表示已过期或即将过期（5分钟内）
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);
    const exp = payload.exp;

    if (!exp) return true;

    const now = Math.floor(Date.now() / 1000);
    // ✅ 如果 Token 在 5 分钟内过期，也认为已过期（提前刷新）
    return now >= (exp - 300);
  } catch (error) {
    console.warn('⚠️ [isTokenExpired] Token解析失败:', error);
    return true;
  }
}

/**
 * 检查 Token 是否过期，如果过期则刷新
 * @returns Promise<boolean> true表示Token有效（已刷新或未过期），false表示刷新失败
 */
export async function ensureTokenValid(): Promise<boolean> {
  const { useAuthStore } = await import('../stores/authStore');
  const state = useAuthStore.getState();

  if (!state.isAuthenticated || !state.token) {
    return false;
  }

  // ✅ 检查 Token 是否过期
  if (isTokenExpired(state.token)) {
    console.log('🔄 [ensureTokenValid] Token已过期，开始刷新...');
    
    try {
      // ✅ 使用 authStore 的刷新方法（内部已有并发控制）
      await state.refreshAccessToken();
      console.log('✅ [ensureTokenValid] Token刷新成功');
      return true;
    } catch (error) {
      console.error('❌ [ensureTokenValid] Token刷新失败:', error);
      // ✅ 刷新失败时，authStore 已经处理了通知和跳转，这里只需要返回 false
      return false;
    }
  }

  // ✅ Token 未过期，直接返回
  return true;
}
