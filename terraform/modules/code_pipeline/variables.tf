variable "repository_url_ingestion" {
  description = "The url of the ECR repository"
}

variable "repository_url_nearest" {
  description = "The url of the ECR repository"
}

variable "repository_url_frontend" {
  description = "The url of the ECR repository"
}
variable "repository_url_db" {
  description = "The url of the ECR repository"
}

variable "repository_url_scoring" {
  description = "The url of the ECR repository"
}

variable "region" {
  description = "The region to use"
}

variable "ecs_cluster_name" {
  description = "The cluster that we will deploy"
}

variable "ecs_service_name" {
  description = "The ECS service that will be deployed"
}

variable "run_task_subnet_id" {
  description = "The subnet Id where single run task will be executed"
}

variable "run_task_security_group_ids" {
  type        = "list"
  description = "The security group Ids attached where the single run task will be executed"
}

variable "github_user" {
  description = "The Github username for repo"
}

variable "github_repo" {
  description = "The Github reponame for repo"
}

variable "github_branch" {
  description = "The Github branch for repo"
}