# Security Group for Redis: Accessible only by private ECS tasks
resource "aws_security_group" "redis" {
  count       = var.create_elasticache ? 1 : 0
  name        = "agentic-redis-sg-${var.environment}"
  description = "Security group for ElastiCache Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow inbound traffic on port 6379 from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.ecs_tasks_security_group_id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "agentic-redis-sg-${var.environment}"
  }
}

# Subnet Group for Redis
resource "aws_elasticache_subnet_group" "redis" {
  count      = var.create_elasticache ? 1 : 0
  name       = "agentic-redis-subnet-group-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "agentic-redis-subnet-group-${var.environment}"
  }
}

# Cost-optimized single node Redis 7 Cluster
resource "aws_elasticache_cluster" "redis" {
  count                = var.create_elasticache ? 1 : 0
  cluster_id           = "agentic-redis-${var.environment}"
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis[0].name
  security_group_ids   = [aws_security_group.redis[0].id]

  tags = {
    Name = "agentic-redis-${var.environment}"
  }
}
