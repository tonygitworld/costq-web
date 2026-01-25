-- Migration: Add org_id field to account tables for multi-tenant support
-- Date: 2025-10-20
-- Description: Add org_id column to aws_accounts and gcp_accounts tables

-- Add org_id to aws_accounts table
ALTER TABLE aws_accounts
ADD COLUMN org_id TEXT;

-- Add org_id to gcp_accounts table
ALTER TABLE gcp_accounts
ADD COLUMN org_id TEXT;

-- Update existing records with a default org_id (if any exist)
-- This assumes a default organization for existing data
UPDATE aws_accounts
SET org_id = 'default-org'
WHERE org_id IS NULL;

UPDATE gcp_accounts
SET org_id = 'default-org'
WHERE org_id IS NULL;

-- Make org_id NOT NULL after updating existing records
ALTER TABLE aws_accounts
ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE gcp_accounts
ALTER COLUMN org_id SET NOT NULL;

-- Add indexes for better query performance
CREATE INDEX idx_aws_accounts_org_id ON aws_accounts(org_id);
CREATE INDEX idx_gcp_accounts_org_id ON gcp_accounts(org_id);

-- Add comments
COMMENT ON COLUMN aws_accounts.org_id IS 'Organization ID for multi-tenant isolation';
COMMENT ON COLUMN gcp_accounts.org_id IS 'Organization ID for multi-tenant isolation';
