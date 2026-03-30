import { apiClient } from '../apiClient';

export interface MarketplaceOnboardingStatus {
  session_token: string;
  status: string;
  expired: boolean;
  expires_at?: string | null;
  organization_id?: string | null;
  subscription_status: string;
  access_active: boolean;
  customer: {
    id: string;
    customer_identifier?: string | null;
    customer_aws_account_id?: string | null;
    product_code: string;
  };
}

export const marketplaceApi = {
  async getOnboardingSessionStatus(sessionToken: string): Promise<MarketplaceOnboardingStatus> {
    return apiClient.get<MarketplaceOnboardingStatus>(
      `/marketplace/onboarding-session/${sessionToken}`,
      { skipAuth: true }
    );
  },

  async claimOnboardingSession(sessionToken: string): Promise<{
    status: string;
    organization_id: string;
    customer_id: string;
    subscription_status: string;
  }> {
    return apiClient.post('/marketplace/claim', { session_token: sessionToken });
  },
};
