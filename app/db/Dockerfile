FROM mysql:5.7

RUN apt-get update && apt-get --assume-yes install wget unzip
RUN wget http://gtfs.openov.nl/gtfs-rt/gtfs-openov-nl.zip
RUN unzip gtfs-openov-nl.zip

COPY ./sql-scripts/ /docker-entrypoint-initdb.d/

# VOLUME /var/lib/mysql