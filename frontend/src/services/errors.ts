/**
 * API客户端错误类定义
 *
 * 提供统一的错误类型，用于API调用的错误处理
 */

import i18n from '../i18n';

/**
 * API客户端基础错误类
 */
export class ApiClientError extends Error {
  declare status?: number;
  declare code?: string;

  constructor(
    message: string,
    status?: number,
    code?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

/**
 * 401 未授权错误
 */
export class UnauthorizedError extends ApiClientError {
  constructor(message?: string) {
    super(message || i18n.t('error:serviceErrors.unauthorized'), 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 禁止访问错误
 */
export class ForbiddenError extends ApiClientError {
  constructor(message?: string) {
    super(message || i18n.t('error:serviceErrors.forbidden'), 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 资源未找到错误
 */
export class NotFoundError extends ApiClientError {
  constructor(message?: string) {
    super(message || i18n.t('error:serviceErrors.notFound'), 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * 422 数据验证错误
 */
export class ValidationError extends ApiClientError {
  declare errors?: Record<string, string[]>;

  constructor(
    message?: string,
    errors?: Record<string, string[]>
  ) {
    super(message || i18n.t('error:serviceErrors.validationFailed'), 422, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * 500 服务器错误
 */
export class ServerError extends ApiClientError {
  constructor(message?: string) {
    super(message || i18n.t('error:serviceErrors.serverError'), 500, 'SERVER_ERROR');
    this.name = 'ServerError';
  }
}
