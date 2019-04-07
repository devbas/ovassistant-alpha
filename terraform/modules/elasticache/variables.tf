variable "environment" {
  description = "The environment"
}

variable "subnet_ids" {
  type        = "list"
  description = "Subnet ids"
}

variable "vpc_id" {
  description = "The VPC id"
}

variable "node_type" {
  description = "The node type"
}

variable "num_cache_nodes" {
  default     = 1
  description = "The number of nodes"
}

variable "az_mode" {
  default     = "single-az"
  description = "Muti-az allowed?"
}
