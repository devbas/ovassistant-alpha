output "repository_url_scoring" {
  value = "${aws_ecr_repository.ovassistant_scoring.repository_url}"
}
output "repository_url_frontend" {
  value = "${aws_ecr_repository.ovassistant_frontend.repository_url}"
}
output "repository_url_nearest" {
  value = "${aws_ecr_repository.ovassistant_nearest.repository_url}"
}
output "repository_url_ingestion" {
  value = "${aws_ecr_repository.ovassistant_ingestion.repository_url}"
}
output "repository_url_db" {
  value = "${aws_ecr_repository.ovassistant_db.repository_url}"
}

output "cluster_name" {
  value = "${aws_ecs_cluster.cluster.name}"
}

output "service_name" {
  value = "${aws_ecs_service.scoring.name}"
}

output "alb_nearest_dns_name" {
  value = "${aws_alb.alb_ovassistant_scoring.dns_name}"
}

output "alb_zone_id" {
  value = "${aws_alb.alb_ovassistant_scoring.zone_id}"
}

output "security_group_id" {
  value = "${aws_security_group.ecs_service.id}"
}
