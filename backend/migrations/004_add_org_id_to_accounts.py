#!/usr/bin/env python3
"""
Migration: Add org_id field to account tables
Date: 2025-10-20
Description: Add org_id column to aws_accounts and gcp_accounts tables for multi-tenant support
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from backend.database import engine, get_database_url


def run_migration():
    """Run the migration to add org_id fields"""
    sql_file = "004_add_org_id_to_accounts.sql"
    print("🔄 Running PostgreSQL migration...")

    # Read SQL file
    migration_dir = Path(__file__).parent
    sql_path = migration_dir / sql_file

    if not sql_path.exists():
        print(f"❌ Migration file not found: {sql_path}")
        return False

    try:
        with open(sql_path, 'r') as f:
            sql_content = f.read()

        # Execute migration
        with engine.connect() as conn:
            # Split SQL content by semicolons and execute each statement
            statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]

            for stmt in statements:
                if stmt.strip():
                    print(f"Executing: {stmt[:50]}...")
                    conn.execute(text(stmt))

            conn.commit()

        print("✅ Migration completed successfully!")
        return True

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False


def check_migration_needed():
    """Check if migration is needed"""
    try:
        with engine.connect() as conn:
            # Check if org_id column exists in aws_accounts
            result = conn.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'aws_accounts' AND column_name = 'org_id'
            """))

            if result.fetchone():
                print("✅ org_id column already exists in aws_accounts table")
                return False
            else:
                print("🔄 org_id column missing, migration needed")
                return True

    except Exception as e:
        print(f"⚠️  Could not check migration status: {e}")
        return True


if __name__ == "__main__":
    print("=== Account Tables org_id Migration ===")

    if check_migration_needed():
        if run_migration():
            print("🎉 Migration completed successfully!")
        else:
            print("💥 Migration failed!")
            sys.exit(1)
    else:
        print("✅ No migration needed - org_id columns already exist")
