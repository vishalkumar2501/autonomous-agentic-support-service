# AWS Production Deployment Guide

This guide provides end-to-end instructions for deploying the **Autonomous Agentic Support Service** to AWS using Terraform, Amazon ECR, Amazon ECS Fargate, and GitHub Actions (OIDC).

---

## 📋 Prerequisites
1. **AWS CLI v2** installed and configured (`aws configure`).
2. **Terraform >= 1.5** installed locally.
3. Access to an AWS account with administrator or deployment privileges.
4. Target GitHub repository: `https://github.com/vishalkumar2501/autonomous-agentic-support-service`.

---

## Step 1: Bootstrap Terraform Remote State (One-Time Setup)

Terraform requires an S3 bucket for state storage and a DynamoDB table for state locking to prevent concurrent deployment conflicts.

Run the following AWS CLI commands (replace `<YOUR_UNIQUE_BUCKET_NAME>`):

```bash
# 1. Create S3 Bucket for Terraform State (ap-south-1 region)
aws s3api create-bucket \
  --bucket autonomous-agentic-tf-state-vishal2501 \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

# 2. Enable S3 Bucket Versioning
aws s3api put-bucket-versioning \
  --bucket autonomous-agentic-tf-state-vishal2501 \
  --versioning-configuration Status=Enabled

# 3. Enable S3 Server-Side Encryption (AES256)
aws s3api put-bucket-encryption \
  --bucket autonomous-agentic-tf-state-vishal2501 \
  --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}'

# 4. Create DynamoDB State Lock Table
aws dynamodb create-table \
  --table-name autonomous-agentic-support-service-tf-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

---

## Step 2: Initialize & Apply Terraform Infrastructure

Navigate to the Terraform directory:

```bash
cd infra/terraform

# Initialize Terraform with your remote S3 state bucket
terraform init \
  -backend-config="bucket=autonomous-agentic-tf-state-vishal2501" \
  -backend-config="dynamodb_table=autonomous-agentic-support-service-tf-locks"

# Review the execution plan
terraform plan -var="environment=dev"

# Apply infrastructure (Run this manually from your local machine - NOT via agent)
terraform apply -var="environment=dev" -auto-approve
```

After completion, note down the Terraform outputs:
- `alb_dns_name`
- `app_url`
- `ecr_repository_url`
- `github_deploy_role_arn`
- `private_subnet_ids`
- `ecs_tasks_security_group_id`

---

## Step 3: Populate AWS Secrets Manager Credentials

Use the AWS CLI to store real secrets in AWS Secrets Manager. Secrets are never saved in source code or Terraform state.

```bash
# 1. Database Connection URL
aws secretsmanager put-secret-value \
  --secret-id "autonomous-agentic/dev/DATABASE_URL" \
  --secret-string "postgresql://vishal2501kvs:YOUR_DB_PASSWORD@YOUR_RDS_HOST:5432/autonomous-agentic-support-service?schema=public" \
  --region ap-south-1

# 2. JWT Access Secret
aws secretsmanager put-secret-value \
  --secret-id "autonomous-agentic/dev/JWT_ACCESS_SECRET" \
  --secret-string "YOUR_RANDOM_SECURE_JWT_ACCESS_SECRET_KEY_MIN_32_CHARS" \
  --region ap-south-1

# 3. JWT Refresh Secret
aws secretsmanager put-secret-value \
  --secret-id "autonomous-agentic/dev/JWT_REFRESH_SECRET" \
  --secret-string "YOUR_RANDOM_SECURE_JWT_REFRESH_SECRET_KEY_MIN_32_CHARS" \
  --region ap-south-1

# 4. Google Gemini API Key
aws secretsmanager put-secret-value \
  --secret-id "autonomous-agentic/dev/GOOGLE_API_KEY" \
  --secret-string "AIzaSyYourRealGeminiApiKeyHere" \
  --region ap-south-1

# 5. Redis URL (if using external or non-ElastiCache Redis)
aws secretsmanager put-secret-value \
  --secret-id "autonomous-agentic/dev/REDIS_URL" \
  --secret-string "redis://YOUR_REDIS_HOST:6379" \
  --region ap-south-1
```

---

## Step 4: Configure GitHub Actions Repository Variables

Go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **Variables** tab (NO raw AWS keys needed thanks to AWS OIDC authentication!).

Create the following Repository Variables:

| Variable Name | Description | Example / Source |
|---|---|---|
| `AWS_ROLE_ARN` | IAM OIDC Role ARN | Output `github_deploy_role_arn` from Terraform |
| `AWS_REGION` | Deployment Region | `ap-south-1` |
| `ECR_REPOSITORY` | ECR Repository Name | `autonomous-agentic-support-service` |
| `ECS_CLUSTER` | ECS Cluster Name | `autonomous-agentic-cluster-dev` |
| `ECS_API_SERVICE` | ECS API Service Name | `agentic-api-dev` |
| `ECS_WORKER_SERVICE` | ECS Worker Service Name | `agentic-worker-dev` |
| `APP_URL` | Application URL for Smoke Testing | Output `app_url` from Terraform |
| `PRIVATE_SUBNET_IDS` | Private Subnets for Migrations | Output `private_subnet_ids` (comma separated) |
| `TASK_SECURITY_GROUP_ID` | Tasks Security Group | Output `ecs_tasks_security_group_id` |

---

## Step 5: Trigger Continuous Deployment

Push changes to the `main` branch:

```bash
git push origin main
```

Monitor the pipeline in GitHub Actions:
1. **Pre-Deployment Verification**: Runs linting, typechecking, Prisma migrations, Vitest tests with service containers, and coverage checks.
2. **ECR Login & Docker Build**: Builds multi-stage Docker image and tags with `${{ github.sha }}` and `latest`.
3. **Database Migration Task**: Runs `sh scripts/migrate.sh` as an isolated one-off ECS Fargate task inside private subnets.
4. **ECS Service Deployment**: Updates `agentic-api-dev` and `agentic-worker-dev` using rolling deployment with circuit breaker rollback.
5. **Post-Deployment Smoke Test**: Pings `GET /api/v1/health` on your ALB.

---

## Step 6: Operational Management & Rollbacks

### How to Check Logs in CloudWatch
View live application and worker logs:
```bash
aws logs tail "/ecs/autonomous-agentic-dev" --follow --region ap-south-1
```

### Automated & Manual Rollback
- **Automated Rollback**: If a newly deployed container fails the health check `/api/v1/health`, the ECS Deployment Circuit Breaker automatically halts deployment and rolls back to the previous stable task definition.
- **Manual Rollback**:
  ```bash
  aws ecs update-service \
    --cluster autonomous-agentic-cluster-dev \
    --service agentic-api-dev \
    --task-definition agentic-api-dev:<PREVIOUS_STABLE_REVISION>
  ```

### Manual Scaling
To scale up during high support traffic:
```bash
aws ecs update-service \
  --cluster autonomous-agentic-cluster-dev \
  --service agentic-api-dev \
  --desired-count 3
```

---

## 💰 Cost Optimization & Estimation

| Component | Sizing / Tier | Estimated Monthly Cost | Optimization Advice |
|---|---|---|---|
| **NAT Gateway** | 1 Single NAT Gateway | ~$32 / month | Set `enable_nat_gateway = false` in development and use VPC endpoints or public IP tasks. |
| **ECS Fargate (API)** | 0.25 vCPU, 0.5 GB RAM (1 task) | ~$9 / month | Use Fargate Spot for up to 70% cost reduction. |
| **ECS Fargate (Worker)**| 0.25 vCPU, 0.5 GB RAM (1 task) | ~$9 / month | Worker scales to 0 during quiet hours. |
| **ElastiCache Redis** | `cache.t4g.micro` (1 node) | ~$13 / month | In dev, set `create_elasticache = false` and use Upstash free tier. |
| **ALB** | Standard Application Load Balancer | ~$16 / month | Shared across microservices if applicable. |
| **Total Estimated Base** | Minimal Dev Setup | **~$40 - $79 / month** | |
