FROM mysql:5.7

RUN apt-get update && apt-get --assume-yes install wget unzip
RUN wget http://gtfs.openov.nl/gtfs-rt/gtfs-openov-nl.zip
RUN unzip gtfs-openov-nl.zip

COPY ./sql-scripts/ovassistant.sql /docker-entrypoint-initdb.d/
COPY ./sql-scripts/z_import.sql /docker-entrypoint-initdb.d/

# VOLUME /var/lib/mysql