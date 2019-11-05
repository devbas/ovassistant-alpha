# ovassistant-alpha
Alpha implementation of OV Assistant, a research project to identify public transport vehicles based on smartphone locations. This repository is made open source since our implementation of background-geolocation tracking on iOS/Android is not reliable enough to draw significant conclusions. 

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
|Reference Latitude|GPS latitude in radians|
|Reference Longitude|GPS longitude in radians|
|Previous Latitude|GPS latitude in radians|
|Previous Longitude|GPS longitude in radians|
|Unique device identifier|Device identifier as obtained by *new-device*|
|Reference coordinates measurement timestamp| UNIX |
|Previous coordinates measurement timestamp| UNIX |


### Raw vehicle data requirements
| Variable | Specification | 
|----------|---------------|
|Current Latitude|GPS latitude in radians|
|Current Longitude|GPS longitude in radians|
|Previous Latitude|GPS latitude in radians|
|Previous Longitude|GPS longitude in radians|
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
