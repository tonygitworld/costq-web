-- Migration: Add IAM Role support
-- Date: 2025-10-30
-- Description: Add support for IAM Role authentication method

-- ============================================================
-- 1. Organizations table - Add external_id column
-- ============================================================

-- Add external_id column for IAM Role External ID
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS external_id VARCHAR(128);

-- Create unique index on external_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_external_id
ON organizations(external_id);

-- Generate external_id for existing organizations
UPDATE organizations
SET external_id = 'org-' || lower(hex(randomblob(16)))
WHERE external_id IS NULL OR external_id = '';

-- Make external_id NOT NULL after populating existing rows
-- Note: SQLite doesn't support ALTER COLUMN, so we'll leave it nullable but enforce in app

-- ============================================================
-- 2. AWS Accounts table - Add IAM Role fields
-- ============================================================

-- Add auth_type column (aksk or iam_role)
ALTER TABLE aws_accounts
ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20) DEFAULT 'aksk';

-- Add role_arn column for IAM Role ARN
ALTER TABLE aws_accounts
ADD COLUMN IF NOT EXISTS role_arn VARCHAR(2048);

-- Add session_duration column for temporary credentials
ALTER TABLE aws_accounts
ADD COLUMN IF NOT EXISTS session_duration INTEGER DEFAULT 3600;

-- Create index on auth_type for faster queries
CREATE INDEX IF NOT EXISTS idx_aws_accounts_auth_type
ON aws_accounts(auth_type);

-- ============================================================
-- 3. Data validation
-- ============================================================

-- Verify existing AKSK accounts have auth_type set
UPDATE aws_accounts
SET auth_type = 'aksk'
WHERE auth_type IS NULL;

-- ============================================================
-- 4. Migration verification
-- ============================================================

-- Count accounts by auth_type
SELECT
    'Auth Type Distribution' as check_name,
    auth_type,
    COUNT(*) as count
FROM aws_accounts
GROUP BY auth_type;

-- Verify organizations have external_id
SELECT
    'Organizations with External ID' as check_name,
    COUNT(*) as total,
    COUNT(external_id) as with_external_id,
    COUNT(external_id) * 100.0 / COUNT(*) as percentage
FROM organizations;

-- ============================================================
-- Migration complete
-- ============================================================
