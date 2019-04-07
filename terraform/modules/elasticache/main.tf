/*====
ElastiCache
======*/

/* subnet used by ElastiCache */
resource "aws_elasticache_subnet_group" "elasticache_subnet_group" {
  name        = "${var.environment}-elasticache-subnet-group"
  description = "ElastiCache subnet group"
  subnet_ids  = ["${var.subnet_ids}"]
}

/* Security Group for resources that want to access the Database */
resource "aws_security_group" "cache_access_sg" {
  vpc_id      = "${var.vpc_id}"
  name        = "${var.environment}-cache-access-sg"
  description = "Allow access to ElastiCache"

  tags {
    Name        = "${var.environment}-cache-access-sg"
    Environment = "${var.environment}"
  }
}

resource "aws_security_group" "elasticache_sg" {
  name = "${var.environment}-elasticache-sg"
  description = "${var.environment} Security Group"
  vpc_id = "${var.vpc_id}"
  tags {
    Name = "${var.environment}-elasticache-sg"
    Environment =  "${var.environment}"
  }

  // allows traffic from the SG itself
  ingress {
      from_port = 0
      to_port = 0
      protocol = "-1"
      self = true
  }

  //allow traffic for TCP 6379
  ingress {
      from_port = 6379
      to_port   = 6379
      protocol  = "tcp"
      security_groups = ["${aws_security_group.cache_access_sg.id}"]
  }

  // outbound internet access
  egress {
    from_port = 0
    to_port = 0
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_parameter_group" "cache" {
  name   = "${var.environment}-cache-parameter-group"
  family = "redis5.0"
}


resource "aws_elasticache_cluster" "cache" {
  cluster_id             = "${var.environment}-cache"
  engine                 = "redis"
  engine_version         = "5.0.3"
  az_mode                = "${var.az_mode}"
  node_type              = "${var.node_type}"
  num_cache_nodes        = "${var.num_cache_nodes}"
  parameter_group_name   = "${aws_elasticache_parameter_group.cache.id}"
  security_group_ids     = ["${aws_security_group.elasticache_sg.id}"]
  subnet_group_name      = "${aws_elasticache_subnet_group.elasticache_subnet_group.id}"
  tags {
    Environment = "${var.environment}"
  }
}
