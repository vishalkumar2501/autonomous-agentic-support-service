# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "autonomous-agentic-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "autonomous-agentic-cluster-${var.environment}"
  }
}

# CloudWatch Log Group with 14-day retention
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/autonomous-agentic-${var.environment}"
  retention_in_days = 14

  tags = {
    Name = "autonomous-agentic-logs-${var.environment}"
  }
}

# 1. API Task Definition
resource "aws_ecs_task_definition" "api" {
  family                   = "agentic-api-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.api_cpu)
  memory                   = tostring(var.api_memory)
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${var.ecr_repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = var.app_port
          hostPort      = var.app_port
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.app_port) },
        { name = "LLM_PROVIDER", value = "gemini" },
        { name = "LLM_MODEL", value = "gemini-2.0-flash" },
        { name = "LLM_TEMPERATURE", value = "0" },
        { name = "AGENT_MAX_STEPS", value = "8" },
        { name = "HIGH_VALUE_THRESHOLD", value = "20000" },
        { name = "RATE_LIMIT_WINDOW_MS", value = "60000" },
        { name = "RATE_LIMIT_MAX", value = "60" },
        { name = "DB_POOL_MAX", value = "10" },
        { name = "CORS_ORIGINS", value = "*" },
        { name = "TRUST_PROXY", value = "1" }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = var.secret_arns.database_url },
        { name = "DIRECT_URL", valueFrom = var.secret_arns.database_url },
        { name = "REDIS_URL", valueFrom = var.secret_arns.redis_url },
        { name = "JWT_ACCESS_SECRET", valueFrom = var.secret_arns.jwt_access_secret },
        { name = "JWT_REFRESH_SECRET", valueFrom = var.secret_arns.jwt_refresh_secret },
        { name = "GOOGLE_API_KEY", valueFrom = var.secret_arns.google_api_key },
        { name = "OPENAI_API_KEY", valueFrom = var.secret_arns.openai_api_key }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])
}

# 2. Worker Task Definition
resource "aws_ecs_task_definition" "worker" {
  family                   = "agentic-worker-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.worker_cpu)
  memory                   = tostring(var.worker_memory)
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = "${var.ecr_repository_url}:latest"
      essential = true
      command   = ["node", "dist/worker.js"]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "WORKER_CONCURRENCY", value = "3" },
        { name = "LLM_PROVIDER", value = "gemini" },
        { name = "LLM_MODEL", value = "gemini-2.0-flash" },
        { name = "LLM_TEMPERATURE", value = "0" },
        { name = "AGENT_MAX_STEPS", value = "8" },
        { name = "HIGH_VALUE_THRESHOLD", value = "20000" },
        { name = "DB_POOL_MAX", value = "10" }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = var.secret_arns.database_url },
        { name = "DIRECT_URL", valueFrom = var.secret_arns.database_url },
        { name = "REDIS_URL", valueFrom = var.secret_arns.redis_url },
        { name = "JWT_ACCESS_SECRET", valueFrom = var.secret_arns.jwt_access_secret },
        { name = "JWT_REFRESH_SECRET", valueFrom = var.secret_arns.jwt_refresh_secret },
        { name = "GOOGLE_API_KEY", valueFrom = var.secret_arns.google_api_key },
        { name = "OPENAI_API_KEY", valueFrom = var.secret_arns.openai_api_key }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])
}

# 3. ECS API Service (Behind ALB with Circuit Breaker Rollback)
resource "aws_ecs_service" "api" {
  name            = "agentic-api-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_min_capacity
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_tasks_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = var.app_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}

# 4. ECS Worker Service (No ALB)
resource "aws_ecs_service" "worker" {
  name            = "agentic-worker-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_min_capacity
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_tasks_security_group_id]
    assign_public_ip = false
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}

# 5. Autoscaling: API Service (Target tracking 60% CPU)
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.api_max_capacity
  min_capacity       = var.api_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "agentic-api-cpu-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# 6. Autoscaling: Worker Service (Target tracking 60% CPU)
resource "aws_appautoscaling_target" "worker" {
  max_capacity       = var.worker_max_capacity
  min_capacity       = var.worker_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "worker_cpu" {
  name               = "agentic-worker-cpu-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
