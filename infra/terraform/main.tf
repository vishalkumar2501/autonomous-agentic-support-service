# Root Terraform Configuration - Autonomous Agentic Support Service

# 1. VPC & Networking Module
module "network" {
  source = "./modules/network"

  vpc_cidr           = var.vpc_cidr
  environment        = var.environment
  app_port           = var.app_port
  enable_nat_gateway = var.enable_nat_gateway
  single_nat_gateway = var.single_nat_gateway
}

# 2. Amazon Elastic Container Registry (ECR)
module "ecr" {
  source = "./modules/ecr"

  environment     = var.environment
  repository_name = "autonomous-agentic-support-service"
}

# 3. Application Load Balancer (ALB)
module "alb" {
  source = "./modules/alb"

  environment         = var.environment
  vpc_id              = module.network.vpc_id
  public_subnet_ids   = module.network.public_subnet_ids
  security_group_id   = module.network.alb_security_group_id
  app_port            = var.app_port
  acm_certificate_arn = var.acm_certificate_arn
}

# 4. AWS Secrets Manager (Application Credentials)
module "secrets" {
  source = "./modules/secrets"

  environment = var.environment
}

# 5. IAM Roles & GitHub Actions OIDC Provider
module "iam" {
  source = "./modules/iam"

  environment       = var.environment
  github_repository = var.github_repository
  github_branch     = var.github_branch
  secret_arns = [
    module.secrets.database_url_arn,
    module.secrets.jwt_access_secret_arn,
    module.secrets.jwt_refresh_secret_arn,
    module.secrets.google_api_key_arn,
    module.secrets.openai_api_key_arn,
    module.secrets.redis_url_arn
  ]
}

# 6. ElastiCache Redis 7 Module
module "redis" {
  source = "./modules/redis"

  environment                 = var.environment
  vpc_id                      = module.network.vpc_id
  private_subnet_ids          = module.network.private_subnet_ids
  ecs_tasks_security_group_id = module.network.ecs_tasks_security_group_id
  create_elasticache          = var.create_elasticache
}

# 7. PostgreSQL RDS Module (Optional, default false)
module "rds" {
  source = "./modules/rds"

  environment                 = var.environment
  vpc_id                      = module.network.vpc_id
  private_subnet_ids          = module.network.private_subnet_ids
  ecs_tasks_security_group_id = module.network.ecs_tasks_security_group_id
  create_rds                  = var.create_rds
}

# 8. ECS Fargate Cluster & Services (API + Worker)
module "ecs" {
  source = "./modules/ecs"

  environment                 = var.environment
  aws_region                  = var.aws_region
  private_subnet_ids          = module.network.private_subnet_ids
  ecs_tasks_security_group_id = module.network.ecs_tasks_security_group_id
  target_group_arn            = module.alb.target_group_arn
  ecr_repository_url          = module.ecr.repository_url
  task_execution_role_arn     = module.iam.task_execution_role_arn
  task_role_arn               = module.iam.task_role_arn

  secret_arns = {
    database_url       = var.create_rds ? module.rds.database_url : module.secrets.database_url_arn
    jwt_access_secret  = module.secrets.jwt_access_secret_arn
    jwt_refresh_secret = module.secrets.jwt_refresh_secret_arn
    google_api_key     = module.secrets.google_api_key_arn
    openai_api_key     = module.secrets.openai_api_key_arn
    redis_url          = var.create_elasticache ? module.secrets.redis_url_arn : module.secrets.redis_url_arn
  }

  app_port            = var.app_port
  api_cpu             = var.api_cpu
  api_memory          = var.api_memory
  worker_cpu          = var.worker_cpu
  worker_memory       = var.worker_memory
  api_min_capacity    = var.api_min_capacity
  api_max_capacity    = var.api_max_capacity
  worker_min_capacity = var.worker_min_capacity
  worker_max_capacity = var.worker_max_capacity
}

# 9. CloudWatch Monitoring & Alarms Module
data "aws_lb" "alb_data" {
  arn = module.alb.alb_arn
}

data "aws_lb_target_group" "tg_data" {
  arn = module.alb.target_group_arn
}

module "monitoring" {
  source = "./modules/monitoring"

  environment             = var.environment
  alb_arn_suffix          = data.aws_lb.alb_data.arn_suffix
  target_group_arn_suffix = data.aws_lb_target_group.tg_data.arn_suffix
  cluster_name            = module.ecs.cluster_name
  api_service_name        = module.ecs.api_service_name
  alert_email             = var.alert_email
}
