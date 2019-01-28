# ovassistant-alpha
Alpha implementation of OV Assistant

## REST API Prerequisites

- Classification from a client application requires a Bearer token provided by Lionoda.

## REST Endpoints 

### `/api/v1/classify/`

## ML Model specification

### Raw user data requirements
| Variable | Specification | 
|----------|---------------|
|Current Latitude||
|Current Longitude||
|Previous Latitude||
|Previous Longitude||
|Unique user/device identifier||
|Current coordinates measurement timestamp| UNIX |
|Previous coordinates measurement timestamp| UNIX |

### Raw vehicle data requirements
| Variable | Specification | 
|----------|---------------|
|Current Latitude||
|Current Longitude||
|Previous Latitude||
|Previous Longitude||
|Unique vehicle identifier||
|Current coordinates measurement timestamp| UNIX |
|Previous coordinates measurement timestamp| UNIX |


### Feature engineering

| Variable | Calculation | Dependent on |
|----------|-------------|--------------|
|Vehicle travel distance|             |              |
|User vehicle distance|             |              |
|User travel distance|             |              |
|Emission probability|||
|Transition probability|||
|Closest stop|||
|Bearing|||
|Transition matrix|||
|Speed|||

### Scoring


### Hyperparameter tuning

### Read more
- (Hidden Markov Map Matching Through Noise and Sparseness)[http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.187.5145&rep=rep1&type=pdf]
