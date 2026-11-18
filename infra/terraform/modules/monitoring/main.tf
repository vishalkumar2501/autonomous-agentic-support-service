# 1. SNS Alert Topic
resource "aws_sns_topic" "alerts" {
  name = "agentic-alerts-topic-${var.environment}"

  tags = {
    Name = "agentic-alerts-topic-${var.environment}"
  }
}

# Optional email subscription
resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# 2. CloudWatch Alarm: API 5xx Responses > 5 in 1 min
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "agentic-api-5xx-high-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Alarm triggers when API service produces more than 5 5XX errors within 1 minute"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }
}

# 3. CloudWatch Alarm: Target Group Unhealthy Host Count >= 1
resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "agentic-unhealthy-hosts-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  alarm_description   = "Alarm triggers when one or more ECS API containers fail health checks"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }
}

# 4. CloudWatch Alarm: ECS API CPU > 80% for 5 mins
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "agentic-high-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alarm triggers when ECS API CPU exceeds 80% for 5 consecutive minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.api_service_name
  }
}
