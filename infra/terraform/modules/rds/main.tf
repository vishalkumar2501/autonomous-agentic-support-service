resource "aws_security_group" "rds" {
  count       = var.create_rds ? 1 : 0
  name        = "agentic-rds-sg-${var.environment}"
  description = "Security group for PostgreSQL RDS"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow PostgreSQL access from ECS tasks on port 5432"
    from_port       = 5432
    to_port         = 5432
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
    Name = "agentic-rds-sg-${var.environment}"
  }
}

resource "aws_db_subnet_group" "rds" {
  count      = var.create_rds ? 1 : 0
  name       = "agentic-db-subnet-group-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "agentic-db-subnet-group-${var.environment}"
  }
}

resource "aws_db_instance" "postgres" {
  count                  = var.create_rds ? 1 : 0
  identifier             = "agentic-postgres-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16.2"
  instance_class         = "db.t4g.micro"
  allocated_storage      = 20
  max_allocated_storage  = 50
  storage_type           = "gp3"
  db_name                = "autonomous_agentic_support"
  username               = "dbadmin"
  password               = "ChangeMeInProduction123!" # Placeholder
  db_subnet_group_name   = aws_db_subnet_group.rds[0].name
  vpc_security_group_ids = [aws_security_group.rds[0].id]
  skip_final_snapshot    = true
  deletion_protection    = false

  tags = {
    Name = "agentic-postgres-${var.environment}"
  }
}
