/**
 * AWS Account Types
 */

export type AuthType = 'aksk' | 'iam_role';

export const AuthType = {
  AKSK: 'aksk' as AuthType,
  IAM_ROLE: 'iam_role' as AuthType,
} as const;
