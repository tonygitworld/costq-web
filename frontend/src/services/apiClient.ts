/**
 * 统一的HTTP API客户端
 *
 * 功能：
 * - 统一的请求/响应处理
 * - 自动添加认证头
 * - 统一的错误处理和转换
 * - 请求超时控制
 * - TypeScript类型安全
 *
 * ✅ 中心化 Token 刷新处理：
 * - 不在请求前检查 Token（避免冲突）
 * - 只在 API 响应 401 时统一处理 Token 刷新
 * - 刷新成功：使用新 Token 重新调用 API
 * - 刷新失败：authStore 处理通知和跳转到登录页
 */

import {
  ApiClientError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ServerError,
} from './errors';

export interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  skipAuth?: boolean;
  skipTokenRefresh?: boolean;  // ✅ 跳过 Token 刷新检查（用于刷新 Token 请求本身）
  returnResponse?: boolean;  // ✅ 返回 Response 对象而不是 JSON（用于 SSE 流式请求）
  retry?: number;  // ✅ 重试次数（默认为 0，不重试）
  retryDelay?: number;  // ✅ 重试延迟（毫秒，默认 1000ms）
}

/**
 * API客户端类
 */
export class ApiClient {
  private baseURL: string;
  private defaultTimeout: number;

  constructor(baseURL: string = '', timeout: number = 30000) {
    this.baseURL = baseURL;
    this.defaultTimeout = timeout;
  }

  /**
   * ✅ 已移除：不再在请求前检查 Token
   * 中心化处理：只在 401 响应时统一处理 Token 刷新
   */

  /**
   * 请求拦截器 - 添加认证头和其他公共配置
   * ✅ 中心化处理：不在请求前检查 Token，只在 401 响应时统一处理
   */
  private async prepareRequest(config: RequestConfig): Promise<RequestInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // 自动添加认证token（除非明确跳过）
    if (!config.skipAuth) {
      const token = await this.getAuthToken();
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
    }

    return {
      ...config,
      headers,
    };
  }

  /**
   * 响应拦截器 - 统一处理响应和错误
   */
  private async handleResponse<T>(response: Response, returnResponse?: boolean): Promise<T | Response> {
    // ✅ 如果请求返回 Response 对象（用于 SSE 流式请求），直接返回
    if (returnResponse) {
      // 仍然需要检查错误状态码
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }
      return response as T;
    }

    // 处理204 No Content
    if (response.status === 204) {
      return null as T;
    }

    // 处理错误响应
    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    // 解析JSON响应
    try {
      return await response.json();
    } catch (error) {
      throw new ApiClientError('无法解析响应数据', response.status);
    }
  }

  /**
   * 错误处理 - 统一的错误转换
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: { detail?: string | { message?: string; error_code?: string }; message?: string };

    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }

    // ✅ 兼容处理：支持 detail 为字符串或对象
    let message: string;
    let errorCode: string | undefined;

    if (typeof errorData.detail === 'string') {
      // 旧格式：detail 是字符串
      message = errorData.detail;
    } else if (typeof errorData.detail === 'object' && errorData.detail !== null) {
      // 新格式：detail 是对象 { message, error_code }
      message = errorData.detail.message || '请求失败';
      errorCode = errorData.detail.error_code;
    } else {
      // 备用：从 message 字段获取
      message = errorData.message || '请求失败';
    }

    // 根据状态码抛出特定错误
    switch (response.status) {
      case 401:
        // ✅ Token刷新和重试在request方法中自动处理
        // 这里只需要抛出错误即可
        throw new UnauthorizedError(message);
      case 403:
        throw new ForbiddenError(message);
      case 404:
        throw new NotFoundError(message);
      case 422:
        throw new ValidationError(message, errorData.errors);
      case 500:
      case 502:
      case 503:
        throw new ServerError(message);
      default:
        throw new ApiClientError(message, response.status, errorCode);
    }
  }

  /**
   * 获取认证token
   * ✅ 直接从 authStore 获取，避免使用全局变量
   */
  private async getAuthToken(): Promise<string | null> {
    const { useAuthStore } = await import('../stores/authStore');
    const state = useAuthStore.getState();
    return state.token || null;
  }

  /**
   * 刷新Token
   * ✅ 直接使用 authStore.refreshAccessToken()，它已经有并发控制
   * 避免循环调用：apiClient -> authStore -> authApi -> apiClient
   */
  private async refreshToken(): Promise<void> {
    const { useAuthStore } = await import('../stores/authStore');
    const state = useAuthStore.getState();

    if (!state.refreshToken) {
      throw new Error('没有刷新令牌');
    }

    // ✅ 直接调用 authStore 的刷新方法（内部已有并发控制和错误处理）
    // authStore.refreshAccessToken() 会调用 authApi.refreshToken()
    // 而 authApi.refreshToken() 使用 skipAuth: true，不会触发这里的刷新逻辑
    await state.refreshAccessToken();
  }

  /**
   * 通用请求方法（带自动重试）
   */
  private async request<T>(
    url: string,
    config: RequestConfig = {}
  ): Promise<T | Response> {
    const { params, timeout, returnResponse, skipTokenRefresh, retry = 0, retryDelay = 1000, ...restConfig } = config;
    let lastError: Error | null = null;

    // ✅ 重试循环
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        return await this.requestInternal<T>(url, {
          ...restConfig,
          params,
          timeout,
          returnResponse,
          skipTokenRefresh,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        // ✅ 如果是最后一次尝试，或者错误不应该重试，直接抛出
        if (attempt === retry) {
          throw err;
        }

        // ✅ 不重试的错误类型
        const shouldNotRetry =
          err instanceof UnauthorizedError ||
          err instanceof ForbiddenError ||
          err instanceof ValidationError ||
          err.name === 'AbortError';

        if (shouldNotRetry) {
          throw err;
        }

        // ✅ 网络错误或服务器错误，等待后重试
        console.warn(`⚠️ [ApiClient] 请求失败 (${attempt + 1}/${retry + 1})，${retryDelay}ms 后重试:`, error.message);

        // 指数退避
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * 内部请求实现
   */
  private async requestInternal<T>(
    url: string,
    config: Omit<RequestConfig, 'retry' | 'retryDelay'>
  ): Promise<T | Response> {
    const { params, timeout, returnResponse, skipTokenRefresh, ...restConfig } = config;

    // 构建完整URL
    let fullUrl = `${this.baseURL}${url}`;
    if (params) {
      const queryString = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString();
      fullUrl += `?${queryString}`;
    }

    // ✅ 准备请求配置（中心化处理：不在请求前检查 Token，只在 401 响应时处理）
    const requestConfig = await this.prepareRequest(restConfig);

    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout || this.defaultTimeout
    );

    try {
      const response = await fetch(fullUrl, {
        ...requestConfig,
        signal: controller.signal,
      });

      // ✅ 中心化处理 401 错误：检测到 401 时，自动刷新 Token 并重试
      // 1. 如果刷新成功，使用新 Token 重新调用 API
      // 2. 如果刷新失败，authStore 会处理通知和跳转到登录页
      if (response.status === 401 && !config.skipAuth && !skipTokenRefresh) {
        // ✅ 关键：如果这是刷新 Token 的请求本身返回 401，不应该再尝试刷新
        if (url.includes('/auth/refresh')) {
          console.warn('⚠️ [ApiClient] Refresh Token 请求返回 401，不再尝试刷新');
          // ✅ 对于流式请求，不能读取响应体，直接抛出错误
          if (returnResponse) {
            throw new UnauthorizedError('Refresh Token 已过期，请重新登录');
          }
          await this.handleErrorResponse(response);
        }

        // ✅ 检查 Refresh Token 是否已过期（刷新失败标记）
        const { useAuthStore } = await import('../stores/authStore');
        const authState = useAuthStore.getState();

        if (authState.refreshFailed) {
          console.warn('⚠️ [ApiClient] Refresh Token 已过期，不再尝试刷新和重试');
          if (returnResponse) {
            throw new UnauthorizedError('Refresh Token 已过期，请重新登录');
          }
          await this.handleErrorResponse(response);
        }

        // ✅ 检查用户是否已登出（可能在刷新过程中被登出）
        if (!authState.isAuthenticated) {
          console.warn('⚠️ [ApiClient] 用户已登出，不再尝试刷新和重试');
          if (returnResponse) {
            throw new UnauthorizedError('用户已登出，请重新登录');
          }
          await this.handleErrorResponse(response);
        }

        // ✅ 尝试刷新 Token 并重试请求
        console.log('🔄 [ApiClient] 检测到 401 错误，尝试刷新 Token...');

        try {
          await this.refreshToken();

          // ✅ 再次检查刷新是否失败
          const currentAuthState = useAuthStore.getState();
          if (currentAuthState.refreshFailed || !currentAuthState.isAuthenticated) {
            console.warn('⚠️ [ApiClient] Token 刷新失败，放弃重试');
            if (returnResponse) {
              throw new UnauthorizedError('Token 刷新失败，请重新登录');
            }
            await this.handleErrorResponse(response);
          }

          // ✅ 使用新的 Token 重试请求
          const newRequestConfig = await this.prepareRequest(restConfig);
          const retryResponse = await fetch(fullUrl, {
            ...newRequestConfig,
            signal: controller.signal,
          });

          // ✅ 如果重试后仍然是 401，抛出错误
          if (retryResponse.status === 401) {
            if (returnResponse) {
              throw new UnauthorizedError('Token 已过期，请重新登录');
            }
            await this.handleErrorResponse(retryResponse);
          }

          return await this.handleResponse<T>(retryResponse, returnResponse);
        } catch (refreshError) {
          console.error('❌ [ApiClient] Token 刷新失败，放弃重试');
          // ✅ 如果已经是 UnauthorizedError，直接抛出（authStore 已处理通知和跳转）
          if (refreshError instanceof UnauthorizedError) {
            throw refreshError;
          }
          if (returnResponse) {
            throw new UnauthorizedError('Token 刷新失败，请重新登录');
          }
          await this.handleErrorResponse(response);
        }
      }

      return await this.handleResponse<T>(response, returnResponse);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name === 'AbortError') {
        throw new ApiClientError('请求超时', 408);
      }

      // ✅ 注意：401 错误的重试逻辑已经在上面处理了（在 response.status === 401 时）
      // 这里只处理其他类型的错误

      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * GET请求
   */
  async get<T = any>(url: string, config?: RequestConfig): Promise<T> {
    console.log('📡 ApiClient.get - URL:', url, 'Config:', config);
    const result = await this.request<T>(url, { ...config, method: 'GET' });
    console.log('✅ ApiClient.get - 响应:', result);
    return result as T;
  }

  /**
   * POST请求
   */
  async post<T = unknown, D = unknown>(
    url: string,
    data?: D,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }) as Promise<T>;
  }

  /**
   * PUT请求
   */
  async put<T = unknown, D = unknown>(
    url: string,
    data?: D,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(url, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }) as Promise<T>;
  }

  /**
   * DELETE请求
   */
  async delete<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    const result = await this.request<T>(url, { ...config, method: 'DELETE' });
    return result as T;
  }

  /**
   * PATCH请求
   */
  async patch<T = unknown, D = unknown>(
    url: string,
    data?: D,
    config?: RequestConfig
  ): Promise<T> {
    const result = await this.request<T>(url, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
    return result as T;
  }

  /**
   * SSE 流式请求（返回 Response 对象，用于读取流）
   *
   * 使用示例：
   * ```typescript
   * const response = await apiClient.stream('/sse/query/v2', { query: '...' });
   * const reader = response.body?.getReader();
   * // ... 处理流式响应
   * ```
   */
  async stream<D = unknown>(
    url: string,
    data?: D,
    config?: RequestConfig
  ): Promise<Response> {
    const result = await this.request<Response>(url, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      returnResponse: true,  // ✅ 返回 Response 对象而不是 JSON
    });
    return result as Response;
  }
}

/**
 * 默认API客户端实例
 */
export const apiClient = new ApiClient('/api');
