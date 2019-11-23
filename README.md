# ovassistant-alpha (in the process of being open-sourced)
Alpha implementation of OV Assistant, a research project to identify public transport vehicles based on smartphone locations. This repository is made open source since our implementation of background-geolocation tracking on iOS/Android is not reliable enough to draw significant conclusions. 

## Installation
Make sure (Docker)[http://docker.com] is installed and run `docker-compose up` in the project root to build all images and run the environment. Please keep in mind that installation can take around 1 hour, especially because of the GTFS schedule import + ZMQ installation. 

## Considerations
This project is designed with the following principles in mind:

1) Data should be locked into OV Assistant and only be exportable by end-users, no third (commercial) parties. 
2) Keep the human in the loop. Any feedback provided by endusers (for example, selecting an alternative vehicle) should be analyzed if it can contribute to a better version of the ML model. 
3) Location history should be kept completely seperate from other personal information, such as, but not limited to, email addresses.

## REST API Prerequisites

- Classification from a client application requires a Bearer token provided by Lionoda.

## REST Endpoints 

|Method|Group|Endpoint|Usage|Device Auth required?|
|------|-----|--------|-----|-------------------|
|POST|Classification|classify|Classify device coordinates|✓|
|POST|Feedback|feedback|Return device feedback for a given classification|✓|
|GET|Device|new-device|Obtain a new device ID|

## ML Model specification (Documentation in Progress)

### Raw device data requirements
| Variable | Specification | 
|----------|---------------|
|Reference Latitude|GPS latitude in decimals|
|Reference Longitude|GPS longitude in decimals|
|Previous Latitude|GPS latitude in decimals|
|Previous Longitude|GPS longitude in decimals|
|Unique device identifier|Device identifier as obtained by *new-device*|
|Reference coordinates measurement timestamp| UNIX |
|Previous coordinates measurement timestamp| UNIX |


### Raw vehicle data requirements
| Variable | Specification | 
|----------|---------------|
|Current Latitude|GPS latitude in decimals|
|Current Longitude|GPS longitude in decimals|
|Previous Latitude|GPS latitude in decimals|
|Previous Longitude|GPS longitude in decimals|
|Unique vehicle identifier|Vehicle identifier in the following format:|
|Current coordinates measurement timestamp| UNIX |
|Previous coordinates measurement timestamp| UNIX |



### Feature engineering

| Variable | Calculation | Dependent on |
|----------|-------------|--------------|
|Reference vehicle latitude|||
|Reference vehicle longitude|||
|Vehicle travel distance|||
|Device vehicle distance|||
|Device travel distance|             |              |
|Emission probability|||
|Transition probability|||
|Closest stop|||
|Bearing|||
|Transition matrix|||
|Speed|||

### Scoring
We score device coordinates against all current vehicles with a convolutional neural net using a so-to-speak 'sliding window' approach. 

### Hyperparameter tuning
- GPS Error margin
- Minimum previous device datetime 
- Minimum previous vehicle datetime

#### How To

### Architecture

### Read more
- (Hidden Markov Map Matching Through Noise and Sparseness)[http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.187.5145&rep=rep1&type=pdf]
- (Real-Time Movement Visualization of Public Transport Data)[http://ad-publications.informatik.uni-freiburg.de/theses/Master_Patrick_Brosi_2014.pdf]
- (Rethinking the Faster R-CNN Archictecture for Temporal Action Localization)[https://arxiv.org/pdf/1804.07667.pdf]
- (Spatio-Temporal Data Mining: A Survey of Problems and Methods)[https://arxiv.org/pdf/1711.04710.pdf]
