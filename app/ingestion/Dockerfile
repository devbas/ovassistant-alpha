FROM node:8.14

RUN apt-get update -qq && apt-get -y install libtool \
    libtool pkg-config build-essential autoconf automake \
    uuid-dev wget
RUN wget -q https://github.com/zeromq/libzmq/releases/download/v4.2.2/zeromq-4.2.2.tar.gz
RUN tar -xzvf zeromq-4.2.2.tar.gz
RUN cd /zeromq-4.2.2 && ./configure && make install & ldconfig

# RUN rm -rf node_modules && \ 
#     apt-get update -qq && \
#     apt-get install -y -qq libzmq-dev && \
#     npm install --silent

# RUN ./configure
# RUN make install & ldconfig

RUN npm install -g nodemon mongoose

# RUN mkdir -p /var/www/ovassistant/app/ingestion

WORKDIR /var/www/ovassistant/app/ingestion
# COPY ./package.json .
# RUN cd /var/www/ovassistant/app/ingestion/ && npm install
# CMD npm install zeromq
# RUN npm install

EXPOSE 8000
CMD npm install && npm install zeromq && npm start