FROM node:8.14

RUN npm install -g nodemon

RUN mkdir -p /var/www/ovassistant/app/frontend

WORKDIR /var/www/ovassistant/app/frontend

EXPOSE 5000
CMD npm install && npm start