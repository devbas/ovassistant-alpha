/*====
Cloudwatch Log Group
======*/
resource "aws_cloudwatch_log_group" "ovassistant_db" {
  name = "ovassistant_db"

  tags {
    Environment = "${var.environment}"
    Application = "OV Assistant"
  }
}


resource "aws_cloudwatch_log_group" "ovassistant_frontend" {
  name = "ovassistant_frontend"

  tags {
    Environment = "${var.environment}"
    Application = "OV Assistant"
  }
}


resource "aws_cloudwatch_log_group" "ovassistant_ingestion" {
  name = "ovassistant_ingestion"

  tags {
    Environment = "${var.environment}"
    Application = "OV Assistant"
  }
}


resource "aws_cloudwatch_log_group" "ovassistant_nearest" {
  name = "ovassistant_nearest"

  tags {
    Environment = "${var.environment}"
    Application = "OV Assistant"
  }
}

resource "aws_cloudwatch_log_group" "ovassistant_scoring" {
  name = "ovassistant_scoring"

  tags {
    Environment = "${var.environment}"
    Application = "OV Assistant"
  }
}


/*====
ECR repository to store our Docker images
======*/
resource "aws_ecr_repository" "ovassistant_scoring" {
  name = "${var.repository_name}"
}

resource "aws_ecr_repository" "ovassistant_nearest" {
  name = "${var.repository_name}"
}

resource "aws_ecr_repository" "ovassistant_ingestion" {
  name = "${var.repository_name}"
}

resource "aws_ecr_repository" "ovassistant_frontend" {
  name = "${var.repository_name}"
}

resource "aws_ecr_repository" "ovassistant_db" {
  name = "${var.repository_name}"
}

/*====
ECS cluster
======*/
resource "aws_ecs_cluster" "cluster" {
  name = "${var.environment}-ecs-cluster"
}

/*====
ECS task definitions
======*/

/* the task definition for the ingestion service */
data "template_file" "ingestion_task" {
  template = "${file("${path.module}/tasks/ingestion_task_definition.json")}"

  vars {
    image           = "${aws_ecr_repository.ovassistant_ingestion.repository_url}"
    database_url              = "mysql://${var.database_username}:${var.database_password}@${var.database_endpoint}:3306/${var.database_name}?encoding=utf8&pool=40"
    database_username         = "${var.database_username}"
    database_password         = "${var.database_password}"
    database_host             = "${var.database_endpoint}"
    database_name             = "${var.database_name}"
    redis_host                = "${var.cache_address}"
    log_group                 = "${aws_cloudwatch_log_group.ovassistant_ingestion.name}"
  }
}

resource "aws_ecs_task_definition" "ingestion" {
  family                   = "${var.environment}_ingestion"
  container_definitions    = "${data.template_file.ingestion_task.rendered}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${aws_iam_role.ecs_execution_role.arn}"
  task_role_arn            = "${aws_iam_role.ecs_execution_role.arn}"
}

/* the task definition for the nearest service */
data "template_file" "nearest_task" {
  template = "${file("${path.module}/tasks/nearest_task_definition.json")}"

  vars {
    image             = "${aws_ecr_repository.ovassistant_nearest.repository_url}"
    database_url              = "mysql://${var.database_username}:${var.database_password}@${var.database_endpoint}:3306/${var.database_name}?encoding=utf8&pool=40"
    database_username         = "${var.database_username}"
    database_password         = "${var.database_password}"
    database_host             = "${var.database_endpoint}"
    database_name             = "${var.database_name}"
    redis_host                = "${var.cache_address}"
    log_group                 = "${aws_cloudwatch_log_group.ovassistant_nearest.name}"
  }
}

resource "aws_ecs_task_definition" "nearest" {
  family                   = "${var.environment}_nearest"
  container_definitions    = "${data.template_file.nearest_task.rendered}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${aws_iam_role.ecs_execution_role.arn}"
  task_role_arn            = "${aws_iam_role.ecs_execution_role.arn}"
}


/* the task definition for the scoring service */
data "template_file" "scoring_task" {
  template = "${file("${path.module}/tasks/scoring_task_definition.json")}"

  vars {
    image             = "${aws_ecr_repository.ovassistant_scoring.repository_url}"
    database_url              = "mysql://${var.database_username}:${var.database_password}@${var.database_endpoint}:3306/${var.database_name}?encoding=utf8&pool=40"
    database_username         = "${var.database_username}"
    database_password         = "${var.database_password}"
    database_host             = "${var.database_endpoint}"
    database_name             = "${var.database_name}"
    redis_host                = "${var.cache_address}"
    log_group                 = "${aws_cloudwatch_log_group.ovassistant_scoring.name}"
  }
}

resource "aws_ecs_task_definition" "scoring" {
  family                   = "${var.environment}_scoring"
  container_definitions    = "${data.template_file.scoring_task.rendered}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${aws_iam_role.ecs_execution_role.arn}"
  task_role_arn            = "${aws_iam_role.ecs_execution_role.arn}"
}

/* the task definition for the frontend service */
data "template_file" "frontend_task" {
  template = "${file("${path.module}/tasks/frontend_task_definition.json")}"

  vars {
    image            = "${aws_ecr_repository.ovassistant_frontend.repository_url}"
    database_url              = "mysql://${var.database_username}:${var.database_password}@${var.database_endpoint}:3306/${var.database_name}?encoding=utf8&pool=40"
    database_username         = "${var.database_username}"
    database_password         = "${var.database_password}"
    database_host             = "${var.database_endpoint}"
    database_name             = "${var.database_name}"
    redis_host                = "${var.cache_address}"
    log_group                 = "${aws_cloudwatch_log_group.ovassistant_frontend.name}"
  }
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.environment}_frontend"
  container_definitions    = "${data.template_file.frontend_task.rendered}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${aws_iam_role.ecs_execution_role.arn}"
  task_role_arn            = "${aws_iam_role.ecs_execution_role.arn}"
}

/* the task definition for the db service */
data "template_file" "db_task" {
  template = "${file("${path.module}/tasks/db_task_definition.json")}"

  vars {
    image            = "${aws_ecr_repository.ovassistant_db.repository_url}"
    database_url              = "mysql://${var.database_username}:${var.database_password}@${var.database_endpoint}:3306/${var.database_name}?encoding=utf8&pool=40"
    database_username         = "${var.database_username}"
    database_password         = "${var.database_password}"
    database_host             = "${var.database_endpoint}"
    database_name             = "${var.database_name}"
    log_group                 = "${aws_cloudwatch_log_group.ovassistant_db.name}"
  }
}

resource "aws_ecs_task_definition" "db" {
  family                   = "${var.environment}_db"
  container_definitions    = "${data.template_file.db_task.rendered}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${aws_iam_role.ecs_execution_role.arn}"
  task_role_arn            = "${aws_iam_role.ecs_execution_role.arn}"
}

/* the task definition for the db migration */
/*data "template_file" "db_migrate_task" {
  template = "${file("${path.module}/tasks/db_migrate_task_definition.json")}"

  vars {
    image           = "${aws_ecr_repository.ovassistant_app.repository_url}"
    database_url    = "mysql://${var.database_username}:${var.database_password}@${var.database_endpoint}:3306/${var.database_name}?encoding=utf8&pool=40"
    log_group       = "ovassistant"
  }
}

resource "aws_ecs_task_definition" "db_migrate" {
  family                   = "${var.environment}_db_migrate"
  container_definitions    = "${data.template_file.db_migrate_task.rendered}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${aws_iam_role.ecs_execution_role.arn}"
  task_role_arn            = "${aws_iam_role.ecs_execution_role.arn}"
}*/

/*====
App Load Balancer
======*/
resource "random_id" "target_group_sufix" {
  byte_length = 2
}

resource "aws_alb_target_group" "alb_target_group" {
  name     = "${var.environment}-alb-target-group-${random_id.target_group_sufix.hex}"
  port     = 80
  protocol = "HTTP"
  vpc_id   = "${var.vpc_id}"
  target_type = "ip"

  lifecycle {
    create_before_destroy = true
  }
}

/* security group for ALB */
resource "aws_security_group" "frontend_inbound_sg" {
  name        = "${var.environment}-frontend-inbound-sg"
  description = "Allow HTTP from Anywhere into ALB"
  vpc_id      = "${var.vpc_id}"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8
    to_port     = 0
    protocol    = "icmp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags {
    Name = "${var.environment}-frontend-inbound-sg"
  }
}

resource "aws_security_group" "ingestion_inbound_sg" {
  name        = "${var.environment}-ingestion-inbound-sg"
  description = "Allow HTTP from Anywhere into ALB"
  vpc_id      = "${var.vpc_id}"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8
    to_port     = 0
    protocol    = "icmp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags {
    Name = "${var.environment}-ingestion-inbound-sg"
  }
}

resource "aws_security_group" "nearest_inbound_sg" {
  name        = "${var.environment}-nearest-inbound-sg"
  description = "Allow HTTP from Anywhere into ALB"
  vpc_id      = "${var.vpc_id}"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8
    to_port     = 0
    protocol    = "icmp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags {
    Name = "${var.environment}-nearest-inbound-sg"
  }
}

resource "aws_security_group" "scoring_inbound_sg" {
  name        = "${var.environment}-scoring-inbound-sg"
  description = "Allow HTTP from Anywhere into ALB"
  vpc_id      = "${var.vpc_id}"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8
    to_port     = 0
    protocol    = "icmp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags {
    Name = "${var.environment}-scoring-inbound-sg"
  }
}

resource "aws_security_group" "db_inbound_sg" {
  name        = "${var.environment}-db-inbound-sg"
  description = "Allow HTTP from Anywhere into ALB"
  vpc_id      = "${var.vpc_id}"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8
    to_port     = 0
    protocol    = "icmp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags {
    Name = "${var.environment}-db-inbound-sg"
  }
}

resource "aws_alb" "alb_ovassistant_scoring" {
  name            = "${var.environment}-alb-ov-scoring"
  subnets         = ["${var.public_subnet_ids}"]
  security_groups = ["${var.security_groups_ids}", "${aws_security_group.scoring_inbound_sg.id}"]

  tags {
    Name        = "${var.environment}-alb-ovassistant_scoring"
    Environment = "${var.environment}"
  }
}

resource "aws_alb_listener" "ovassistant_scoring" {
  load_balancer_arn = "${aws_alb.alb_ovassistant_scoring.arn}"
  port              = "80"
  protocol          = "HTTP"
  depends_on        = ["aws_alb_target_group.alb_target_group"]

  default_action {
    target_group_arn = "${aws_alb_target_group.alb_target_group.arn}"
    type             = "forward"
  }
}

resource "aws_alb" "alb_nearest" {
  name            = "${var.environment}-alb-nearest"
  subnets         = ["${var.public_subnet_ids}"]
  security_groups = ["${var.security_groups_ids}", "${aws_security_group.nearest_inbound_sg.id}"]

  tags {
    Name        = "${var.environment}-alb-nearest"
    Environment = "${var.environment}"
  }
}

resource "aws_alb_listener" "nearest" {
  load_balancer_arn = "${aws_alb.alb_nearest.arn}"
  port              = "80"
  protocol          = "HTTP"
  depends_on        = ["aws_alb_target_group.alb_target_group"]

  default_action {
    target_group_arn = "${aws_alb_target_group.alb_target_group.arn}"
    type             = "forward"
  }
}

resource "aws_alb" "alb_ovassistant_ingestion" {
  name            = "${var.environment}-alb-ov-ingestion"
  subnets         = ["${var.public_subnet_ids}"]
  security_groups = ["${var.security_groups_ids}", "${aws_security_group.ingestion_inbound_sg.id}"]

  tags {
    Name        = "${var.environment}-alb-ovassistant_ingestion"
    Environment = "${var.environment}"
  }
}

resource "aws_alb_listener" "ovassistant_ingestion" {
  load_balancer_arn = "${aws_alb.alb_ovassistant_ingestion.arn}"
  port              = "80"
  protocol          = "HTTP"
  depends_on        = ["aws_alb_target_group.alb_target_group"]

  default_action {
    target_group_arn = "${aws_alb_target_group.alb_target_group.arn}"
    type             = "forward"
  }
}

resource "aws_alb" "alb_ovassistant_frontend" {
  name            = "${var.environment}-alb-ov-frontend"
  subnets         = ["${var.public_subnet_ids}"]
  security_groups = ["${var.security_groups_ids}", "${aws_security_group.frontend_inbound_sg.id}"]

  tags {
    Name        = "${var.environment}-alb-ovassistant_frontend"
    Environment = "${var.environment}"
  }
}

resource "aws_alb_listener" "ovassistant_frontend" {
  load_balancer_arn = "${aws_alb.alb_ovassistant_frontend.arn}"
  port              = "80"
  protocol          = "HTTP"
  depends_on        = ["aws_alb_target_group.alb_target_group"]

  default_action {
    target_group_arn = "${aws_alb_target_group.alb_target_group.arn}"
    type             = "forward"
  }
}

resource "aws_alb" "alb_ovassistant_db" {
  name            = "${var.environment}-alb-ov-db"
  subnets         = ["${var.public_subnet_ids}"]
  security_groups = ["${var.security_groups_ids}", "${aws_security_group.db_inbound_sg.id}"]

  tags {
    Name        = "${var.environment}-alb-ovassistant_db"
    Environment = "${var.environment}"
  }
}

resource "aws_alb_listener" "ovassistant_db" {
  load_balancer_arn = "${aws_alb.alb_ovassistant_db.arn}"
  port              = "80"
  protocol          = "HTTP"
  depends_on        = ["aws_alb_target_group.alb_target_group"]

  default_action {
    target_group_arn = "${aws_alb_target_group.alb_target_group.arn}"
    type             = "forward"
  }
}

/*
* IAM service role
*/
data "aws_iam_policy_document" "ecs_service_role" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type = "Service"
      identifiers = ["ecs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_role" {
  name               = "ecs_role"
  assume_role_policy = "${data.aws_iam_policy_document.ecs_service_role.json}"
}

data "aws_iam_policy_document" "ecs_service_policy" {
  statement {
    effect = "Allow"
    resources = ["*"]
    actions = [
      "elasticloadbalancing:Describe*",
      "elasticloadbalancing:DeregisterInstancesFromLoadBalancer",
      "elasticloadbalancing:RegisterInstancesWithLoadBalancer",
      "ec2:Describe*",
      "ec2:AuthorizeSecurityGroupIngress"
    ]
  }
}

/* ecs service scheduler role */
resource "aws_iam_role_policy" "ecs_service_role_policy" {
  name   = "ecs_service_role_policy"
  #policy = "${file("${path.module}/policies/ecs-service-role.json")}"
  policy = "${data.aws_iam_policy_document.ecs_service_policy.json}"
  role   = "${aws_iam_role.ecs_role.id}"
}

/* role that the Amazon ECS container agent and the Docker daemon can assume */
resource "aws_iam_role" "ecs_execution_role" {
  name               = "ecs_task_execution_role"
  assume_role_policy = "${file("${path.module}/policies/ecs-task-execution-role.json")}"
}
resource "aws_iam_role_policy" "ecs_execution_role_policy" {
  name   = "ecs_execution_role_policy"
  policy = "${file("${path.module}/policies/ecs-execution-role-policy.json")}"
  role   = "${aws_iam_role.ecs_execution_role.id}"
}

/*====
ECS service
======*/

/* Security Group for ECS */
resource "aws_security_group" "ecs_service" {
  vpc_id      = "${var.vpc_id}"
  name        = "${var.environment}-ecs-service-sg"
  description = "Allow egress from container"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8
    to_port     = 0
    protocol    = "icmp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags {
    Name        = "${var.environment}-ecs-service-sg"
    Environment = "${var.environment}"
  }
}

/* Simply specify the family to find the latest ACTIVE revision in that family 
data "aws_ecs_task_definition" "web" {
  depends_on = [ "aws_ecs_task_definition.web" ]
  task_definition = "${aws_ecs_task_definition.web.family}"
}

resource "aws_ecs_service" "web" {
  name            = "${var.environment}-web"
  task_definition = "${aws_ecs_task_definition.web.family}:${max("${aws_ecs_task_definition.web.revision}", "${data.aws_ecs_task_definition.web.revision}")}"
  desired_count   = 1
  launch_type     = "FARGATE"
  cluster =       "${aws_ecs_cluster.cluster.id}"
  depends_on      = ["aws_iam_role_policy.ecs_service_role_policy"]

  network_configuration {
    security_groups = ["${var.security_groups_ids}", "${aws_security_group.ecs_service.id}"]
    subnets         = ["${var.subnets_ids}"]
  }

  load_balancer {
    target_group_arn = "${aws_alb_target_group.alb_target_group.arn}"
    container_name   = "web"
    container_port   = "4000"
  }

  depends_on = ["aws_alb_target_group.alb_target_group"]
}
*/
data "aws_ecs_task_definition" "scoring" {
  depends_on = [ "aws_ecs_task_definition.scoring" ]
  task_definition = "${aws_ecs_task_definition.scoring.family}"
}

resource "aws_ecs_service" "scoring" {
  name            = "${var.environment}-scoring"
  task_definition = "${aws_ecs_task_definition.scoring.family}:${max("${aws_ecs_task_definition.scoring.revision}", "${data.aws_ecs_task_definition.scoring.revision}")}"
  desired_count   = 1
  launch_type     = "FARGATE"
  cluster =       "${aws_ecs_cluster.cluster.id}"
  depends_on      = ["aws_iam_role_policy.ecs_service_role_policy"]

  network_configuration {
    security_groups = ["${var.security_groups_ids}", "${aws_security_group.ecs_service.id}"]
    subnets         = ["${var.subnets_ids}"]
  }

  load_balancer {
    target_group_arn = "${aws_alb_target_group.alb_target_group.arn}"
    container_name   = "scoring"
    container_port   = "4000"
  }

  depends_on = ["aws_alb_target_group.alb_target_group"]
}

data "aws_ecs_task_definition" "nearest" {
  depends_on = [ "aws_ecs_task_definition.nearest" ]
  task_definition = "${aws_ecs_task_definition.nearest.family}"
}

resource "aws_ecs_service" "nearest" {
  name            = "${var.environment}-nearest"
  task_definition = "${aws_ecs_task_definition.nearest.family}:${max("${aws_ecs_task_definition.nearest.revision}", "${data.aws_ecs_task_definition.nearest.revision}")}"
  desired_count   = 1
  launch_type     = "FARGATE"
  cluster =       "${aws_ecs_cluster.cluster.id}"
  depends_on      = ["aws_iam_role_policy.ecs_service_role_policy"]

  network_configuration {
    security_groups = ["${var.security_groups_ids}", "${aws_security_group.ecs_service.id}"]
    subnets         = ["${var.subnets_ids}"]
  }

  load_balancer {
    target_group_arn = "${aws_alb_target_group.alb_target_group.arn}"
    container_name   = "nearest"
    container_port   = "4000"
  }

  depends_on = ["aws_alb_target_group.alb_target_group"]
}

data "aws_ecs_task_definition" "frontend" {
  depends_on = [ "aws_ecs_task_definition.frontend" ]
  task_definition = "${aws_ecs_task_definition.frontend.family}"
}

resource "aws_ecs_service" "frontend" {
  name            = "${var.environment}-frontend"
  task_definition = "${aws_ecs_task_definition.frontend.family}:${max("${aws_ecs_task_definition.frontend.revision}", "${data.aws_ecs_task_definition.frontend.revision}")}"
  desired_count   = 1
  launch_type     = "FARGATE"
  cluster =       "${aws_ecs_cluster.cluster.id}"
  depends_on      = ["aws_iam_role_policy.ecs_service_role_policy"]

  network_configuration {
    security_groups = ["${var.security_groups_ids}", "${aws_security_group.ecs_service.id}"]
    subnets         = ["${var.subnets_ids}"]
  }

  load_balancer {
    target_group_arn = "${aws_alb_target_group.alb_target_group.arn}"
    container_name   = "frontend"
    container_port   = "4000"
  }

  depends_on = ["aws_alb_target_group.alb_target_group"]
}

data "aws_ecs_task_definition" "db" {
  depends_on = [ "aws_ecs_task_definition.db" ]
  task_definition = "${aws_ecs_task_definition.db.family}"
}

resource "aws_ecs_service" "db" {
  name            = "${var.environment}-db"
  task_definition = "${aws_ecs_task_definition.db.family}:${max("${aws_ecs_task_definition.db.revision}", "${data.aws_ecs_task_definition.db.revision}")}"
  desired_count   = 1
  launch_type     = "FARGATE"
  cluster =       "${aws_ecs_cluster.cluster.id}"
  depends_on      = ["aws_iam_role_policy.ecs_service_role_policy"]

  network_configuration {
    security_groups = ["${var.security_groups_ids}", "${aws_security_group.ecs_service.id}"]
    subnets         = ["${var.subnets_ids}"]
  }
}

data "aws_ecs_task_definition" "ingestion" {
  depends_on = [ "aws_ecs_task_definition.ingestion" ]
  task_definition = "${aws_ecs_task_definition.ingestion.family}"
}

resource "aws_ecs_service" "ingestion" {
  name            = "${var.environment}-ingestion"
  task_definition = "${aws_ecs_task_definition.ingestion.family}:${max("${aws_ecs_task_definition.ingestion.revision}", "${data.aws_ecs_task_definition.ingestion.revision}")}"
  desired_count   = 1
  launch_type     = "FARGATE"
  cluster =       "${aws_ecs_cluster.cluster.id}"
  depends_on      = ["aws_iam_role_policy.ecs_service_role_policy"]

  network_configuration {
    security_groups = ["${var.security_groups_ids}", "${aws_security_group.ecs_service.id}"]
    subnets         = ["${var.subnets_ids}"]
  }
}


/*====
Auto Scaling for ECS
======*/

resource "aws_iam_role" "ecs_autoscale_role" {
  name               = "${var.environment}_ecs_autoscale_role"
  assume_role_policy = "${file("${path.module}/policies/ecs-autoscale-role.json")}"
}
resource "aws_iam_role_policy" "ecs_autoscale_role_policy" {
  name   = "ecs_autoscale_role_policy"
  policy = "${file("${path.module}/policies/ecs-autoscale-role-policy.json")}"
  role   = "${aws_iam_role.ecs_autoscale_role.id}"
}
/*
resource "aws_appautoscaling_target" "target" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.cluster.name}/${aws_ecs_service.web.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  role_arn           = "${aws_iam_role.ecs_autoscale_role.arn}"
  min_capacity       = 1
  max_capacity       = 3
}

resource "aws_appautoscaling_policy" "up" {
  name                    = "${var.environment}_scale_up"
  service_namespace       = "ecs"
  resource_id             = "service/${aws_ecs_cluster.cluster.name}/${aws_ecs_service.web.name}"
  scalable_dimension      = "ecs:service:DesiredCount"


  step_scaling_policy_configuration {
    adjustment_type         = "ChangeInCapacity"
    cooldown                = 60
    metric_aggregation_type = "Maximum"

    step_adjustment {
      metric_interval_lower_bound = 0
      scaling_adjustment = 1
    }
  }

  depends_on = ["aws_appautoscaling_target.target"]
}

resource "aws_appautoscaling_policy" "down" {
  name                    = "${var.environment}_scale_down"
  service_namespace       = "ecs"
  resource_id             = "service/${aws_ecs_cluster.cluster.name}/${aws_ecs_service.web.name}"
  scalable_dimension      = "ecs:service:DesiredCount"

  step_scaling_policy_configuration {
    adjustment_type         = "ChangeInCapacity"
    cooldown                = 60
    metric_aggregation_type = "Maximum"

    step_adjustment {
      metric_interval_lower_bound = 0
      scaling_adjustment = -1
    }
  }

  depends_on = ["aws_appautoscaling_target.target"]
}*/

/* metric used for auto scale
resource "aws_cloudwatch_metric_alarm" "service_cpu_high" {
  alarm_name          = "${var.environment}_ovassistant_web_cpu_utilization_high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "85"

  dimensions {
    ClusterName = "${aws_ecs_cluster.cluster.name}"
//    ServiceName = "${aws_ecs_service.web.name}"
  }

  alarm_actions = ["${aws_appautoscaling_policy.up.arn}"]
  ok_actions    = ["${aws_appautoscaling_policy.down.arn}"]
}
resource "aws_cloudwatch_metric_alarm" "service_memory_high" {
  alarm_name          = "${var.environment}_ovassistant_web_memory_utilization_high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "85"

  dimensions {
    ClusterName = "${aws_ecs_cluster.cluster.name}"
  //  ServiceName = "${aws_ecs_service.web.name}"
  }

  alarm_actions = ["${aws_appautoscaling_policy.up.arn}"]
  ok_actions    = ["${aws_appautoscaling_policy.down.arn}"]
}
 */