data "aws_availability_zones" "available" {
  state = "available"
}

# 1. Virtual Private Cloud (VPC)
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "autonomous-agentic-vpc-${var.environment}"
  }
}

# 2. Public Subnets (across 2 AZs)
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "autonomous-agentic-public-${count.index + 1}-${var.environment}"
    Tier = "Public"
  }
}

# 3. Private Subnets (across 2 AZs)
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 2)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "autonomous-agentic-private-${count.index + 1}-${var.environment}"
    Tier = "Private"
  }
}

# 4. Internet Gateway for Public Traffic
resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "autonomous-agentic-igw-${var.environment}"
  }
}

# 5. Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? 1 : 0
  domain = "vpc"

  tags = {
    Name = "autonomous-agentic-nat-eip-${var.environment}"
  }
}

# 6. Cost-optimized single NAT Gateway
resource "aws_nat_gateway" "nat" {
  count         = var.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "autonomous-agentic-nat-${var.environment}"
  }

  depends_on = [aws_internet_gateway.gw]
}

# 7. Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name = "autonomous-agentic-public-rt-${var.environment}"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.nat[0].id
    }
  }

  tags = {
    Name = "autonomous-agentic-private-rt-${var.environment}"
  }
}

# 8. Route Table Associations
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# 9. Security Groups
# ALB Security Group: Inbound HTTP/HTTPS from Internet, outbound to ECS tasks only
resource "aws_security_group" "alb" {
  name        = "autonomous-agentic-alb-sg-${var.environment}"
  description = "Security group for external Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow inbound HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow inbound HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow outbound to VPC tasks"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "autonomous-agentic-alb-sg-${var.environment}"
  }
}

# ECS Tasks Security Group: Inbound from ALB only, outbound HTTPS for LLM API and DB calls
resource "aws_security_group" "ecs_tasks" {
  name        = "autonomous-agentic-ecs-tasks-sg-${var.environment}"
  description = "Security group for private ECS API and Worker tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow traffic from ALB to API container port"
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow all outbound traffic (LLM APIs, DB, external services)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "autonomous-agentic-ecs-tasks-sg-${var.environment}"
  }
}
