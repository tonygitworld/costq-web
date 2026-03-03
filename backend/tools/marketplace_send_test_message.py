#!/usr/bin/env python3
"""Send a test Marketplace notification message to SQS (dev helper).

This is used before we have real AWS Marketplace SNS topic ARN.
It sends a message shaped like Marketplace notification to the SQS queue,
so the marketplace_sqs_worker can be validated end-to-end.

Usage:
  AWS_REGION=ap-northeast-1 \
  MARKETPLACE_SQS_QUEUE_URL=... \
  python backend/tools/marketplace_send_test_message.py \
    --customer-identifier X01EXAMPLEX \
    --product-code n0123EXAMPLEXXXXXXXXXXXX \
    --action subscribe-success

Note: This script does NOT require dvcode.
"""

from __future__ import annotations

import argparse
import json
import os

import boto3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--customer-identifier', required=True)
    ap.add_argument('--product-code', required=True)
    ap.add_argument('--action', default='entitlement-updated')
    ap.add_argument('--sns-envelope', action='store_true', help='Wrap as SNS envelope JSON in SQS body')
    args = ap.parse_args()

    queue_url = os.getenv('MARKETPLACE_SQS_QUEUE_URL')
    if not queue_url:
        raise SystemExit('MARKETPLACE_SQS_QUEUE_URL is required')

    region = os.getenv('AWS_REGION') or os.getenv('AWS_DEFAULT_REGION')

    payload = {
        'action': args.action,
        'customer-identifier': args.customer_identifier,
        'product-code': args.product_code,
    }

    if args.sns_envelope:
        body = json.dumps({
            'Type': 'Notification',
            'MessageId': 'test-message-id',
            'TopicArn': 'arn:aws:sns:region:acct:test',
            'Message': json.dumps(payload),
        })
    else:
        body = json.dumps(payload)

    sqs = boto3.client('sqs', region_name=region)
    sqs.send_message(QueueUrl=queue_url, MessageBody=body)
    print('sent')


if __name__ == '__main__':
    main()
