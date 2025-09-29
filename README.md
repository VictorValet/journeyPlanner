# journeyPlanner
An API endpoint to retrieve the best journey option with Poppy

## Installation
Ensure you have Node.js and npm install
```
git clone https://github.com/VictorValet/journeyPlanner.git
cd journeyPlanner
npm install
node index.js
```
## Test
Just `./test.sh` or send a request to localhost with 
* Headers as:
```
{"Content-Type: application/json"}
```
* Body as:
```
[
    {
        "timestamp": [datetime],
        "start": {
            "latitude": 123.45,
            "longitude": 67.89
        },
        "end": {
            "latitude": 123.45,
            "longitude": 67.89
        }
    },
    {
        "timestamp": [datetime],
        "start": {
            "latitude": 123.45,
            "longitude": 67.89
        },
        "end": {
            "latitude": 123.45,
            "longitude": 67.89
        }
    }
]
```
