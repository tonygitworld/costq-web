"""AWS Marketplace service wrapper.

Implements:
- ResolveCustomer (token -> customerIdentifier)
- GetEntitlement (customerIdentifier -> entitlement/plan)

Notes:
- Actual boto3 client service name/actions must follow AWS official docs.
- We keep this service thin so it can be mocked in tests.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import boto3


@dataclass
class ResolvedCustomer:
    customer_identifier: str
    product_code: str | None = None


class MarketplaceService:
    def __init__(self, region_name: str | None = None):
        self.region_name = region_name

    def resolve_customer(self, *, token: str) -> ResolvedCustomer:
        # Placeholder: implementation will be aligned with AWS Marketplace Metering ResolveCustomer.
        client = boto3.client("meteringmarketplace", region_name=self.region_name)
        resp = client.resolve_customer(RegistrationToken=token)
        return ResolvedCustomer(
            customer_identifier=resp.get("CustomerIdentifier"),
            product_code=resp.get("ProductCode"),
        )

    def get_entitlements(self, *, product_code: str, customer_identifier: str) -> list[dict[str, Any]]:
        client = boto3.client("marketplace-entitlement", region_name=self.region_name)
        paginator = client.get_paginator("get_entitlements")
        entitlements: list[dict[str, Any]] = []
        for page in paginator.paginate(ProductCode=product_code, Filter={"CUSTOMER_IDENTIFIER": [customer_identifier]}):
            entitlements.extend(page.get("Entitlements", []))
        return entitlements
