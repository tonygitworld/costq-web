import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Spin, Typography } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { marketplaceApi, type MarketplaceOnboardingStatus } from '../../services/api/marketplaceApi';
import { useAuthStore } from '../../stores/authStore';
import { AuthLayout } from './AuthLayout';
import { FormCard } from './FormCard';

const { Title, Paragraph, Text } = Typography;

export const MarketplaceOnboarding: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [loading, setLoading] = useState(true);
  const [binding, setBinding] = useState(false);
  const [status, setStatus] = useState<MarketplaceOnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionToken = searchParams.get('session');

  useEffect(() => {
    if (!sessionToken) {
      setLoading(false);
      setError('Missing Marketplace onboarding session.');
      return;
    }

    const load = async () => {
      try {
        const result = await marketplaceApi.getOnboardingSessionStatus(sessionToken);
        setStatus(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Marketplace session.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken || !isAuthenticated || !status || status.organization_id || status.expired) {
      return;
    }

    const claim = async () => {
      setBinding(true);
      try {
        await marketplaceApi.claimOnboardingSession(sessionToken);
        navigate('/', { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to bind Marketplace subscription.');
      } finally {
        setBinding(false);
      }
    };

    void claim();
  }, [isAuthenticated, navigate, sessionToken, status]);

  const authQuery = useMemo(() => (
    sessionToken ? `?marketplace_session=${encodeURIComponent(sessionToken)}` : ''
  ), [sessionToken]);

  return (
    <AuthLayout showBackButton backTo="/login">
      <FormCard wide>
        <Title level={3}>AWS Marketplace onboarding</Title>
        <Paragraph type="secondary">
          Use this page to bind your AWS Marketplace CostQ subscription to a new or existing CostQ organization.
        </Paragraph>

        {loading && (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <Spin />
          </div>
        )}

        {!loading && error && (
          <Alert type="error" showIcon message={error} />
        )}

        {!loading && !error && status?.expired && (
          <Alert
            type="warning"
            showIcon
            message="This Marketplace onboarding session has expired."
            description="Start the subscription flow again from AWS Marketplace to create a new onboarding session."
          />
        )}

        {!loading && !error && status && !status.expired && (
          <>
            <Alert
              type="info"
              showIcon
              message={`Marketplace subscription status: ${status.subscription_status}`}
              description={status.organization_id
                ? (status.access_active
                  ? 'This subscription is already bound to a CostQ organization. Sign in to continue.'
                  : 'This subscription is bound, but access is not active yet. Wait for Marketplace entitlement sync to complete or contact support.')
                : 'Complete sign-in or registration to bind this subscription.'}
              style={{ marginBottom: 24 }}
            />

            {binding && (
              <div style={{ paddingBottom: 16 }}>
                <Spin />
                <Text style={{ marginLeft: 8 }}>Binding Marketplace subscription to your organization...</Text>
              </div>
            )}

            {!isAuthenticated && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to={`/login${authQuery}`}>
                  <Button type="primary" size="large">Sign in</Button>
                </Link>
                <Link to={`/register${authQuery}`}>
                  <Button size="large">Create organization</Button>
                </Link>
              </div>
            )}

            {status.organization_id && !isAuthenticated && (
              <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
                <Text type="secondary">
                  If this subscription was already linked by another user in your team, sign in with that organization account.
                </Text>
              </Paragraph>
            )}
          </>
        )}
      </FormCard>
    </AuthLayout>
  );
};

export default MarketplaceOnboarding;
