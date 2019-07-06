FROM python:3.6.1

# RUN apk update \
#   && apk add \
#     build-base \
#     libpq \
#     python3-dev \
#     libffi \
#     libffi-dev \
#     openssl-dev

RUN mkdir /usr/src/app
WORKDIR /usr/src/app
COPY ./requirements.txt .

# Since these libraries take a significant amount of time to build, installing them here saves us build-time in the future. 
RUN pip install pandas
RUN pip install mysql-connector
RUN pip install numpy 
RUN pip install -r requirements.txt

ENV PYTHONUNBUFFERED 1

EXPOSE 9001 