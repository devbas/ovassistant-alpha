FROM node:8.14

RUN npm install -g nodemon mongoose

RUN mkdir -p /var/www/ovassistant/app/scoring

WORKDIR /var/www/ovassistant/app/scoring

EXPOSE 8001
CMD npm install && npm install bcrypt && npm start