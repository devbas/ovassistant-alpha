output "hostname" {
  value = "${aws_elasticache_cluster.cache.cache_nodes.0.address}"
}

output "port" {
  value = "${aws_elasticache_cluster.cache.cache_nodes.0.port}"
}

output "cache_access_sg_id" {
  value = "${aws_security_group.cache_access_sg.id}"
}