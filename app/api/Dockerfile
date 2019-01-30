FROM node:8.14

RUN apt-get update && apt-get -y install libtool \
    libtool pkg-config build-essential autoconf automake \
    uuid-dev wget
RUN wget -q https://github.com/zeromq/libzmq/releases/download/v4.2.2/zeromq-4.2.2.tar.gz
RUN tar -xzvf zeromq-4.2.2.tar.gz
WORKDIR /zeromq-4.2.2
RUN ./configure
RUN make install & ldconfig

# WORKDIR .
RUN npm install -g nodemon mongoose

RUN mkdir -p /var/www/ovassistant/app/api

WORKDIR /var/www/ovassistant/app/api
COPY ./package.json .
# RUN cd /var/www/ovassistant/app/api/ && npm install
RUN npm install zeromq
RUN npm install

EXPOSE 8000
CMD ["node", "server.js"]