#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# localstack-init.sh — LOCAL DEV ONLY. Runs inside LocalStack when it is ready.
#
# Creates the S3 buckets and SQS queues (with dead-letter queues) that the app
# expects, mirroring the names CDK creates in AWS, with a "-local" suffix.
# -----------------------------------------------------------------------------
set -euo pipefail

region="ap-south-1"

# Buckets: raw uploads (private, scanned and processed) and public processed media.
for b in thaala-media-raw-local thaala-media-public-local thaala-exports-local; do
  awslocal s3 mb "s3://$b" --region "$region" || true
done

# Queues: each work queue gets a DLQ so poison messages don't loop forever.
for q in matching notifications media payouts privacy; do
  dlq_url="$(awslocal sqs create-queue --queue-name "thaala-local-${q}-dlq" --query QueueUrl --output text)"
  dlq_arn="$(awslocal sqs get-queue-attributes --queue-url "$dlq_url" --attribute-names QueueArn --query Attributes.QueueArn --output text)"
  awslocal sqs create-queue --queue-name "thaala-local-${q}" \
    --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"${dlq_arn}\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"}" >/dev/null
done

echo "LocalStack: buckets and queues ready"
