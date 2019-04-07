
module "code_pipeline" {
  source                      = "./modules/code_pipeline"
  repository_url              = "${module.ecs.repository_url}"
  github_user                 = "${var.github_user}"
  github_repo                 = "${var.github_repo}"
  github_branch               = "master"
  region                      = "${var.region}"
  ecs_service_name            = "${module.ecs.service_name}"
  ecs_cluster_name            = "${module.ecs.cluster_name}"
  run_task_subnet_id          = "${module.networking.private_subnets_id[0]}"
  run_task_security_group_ids = ["${module.elasticache.cache_access_sg_id}", "${module.rds.db_access_sg_id}", "${module.networking.security_groups_ids}", "${module.ecs.security_group_id}"]
}
