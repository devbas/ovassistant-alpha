#!/bin/bash
/usr/bin/mysqld_safe --skip-grant-tables &
sleep 5
mysql -u root -e "CREATE DATABASE ovassistant"
mysql -u root ovassistant < /tmp/ovassistant.sql