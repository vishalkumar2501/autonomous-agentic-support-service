# Remote state backend configuration
# Note: For initial bootstrap, create the S3 bucket and DynamoDB table first,
# then run: terraform init -backend-config="bucket=<YOUR_BUCKET>" -backend-config="dynamodb_table=<YOUR_LOCK_TABLE>"
terraform {
  backend "s3" {
    key            = "state/autonomous-agentic-support-service/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "autonomous-agentic-support-service-tf-locks"
  }
}
