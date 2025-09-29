TIME_A=$(date -u -d "+ 30 minutes" +"%Y-%m-%dT%H:%M:%SZ")
TIME_B=$(date -u -d "+ 70 minutes" +"%Y-%m-%dT%H:%M:%SZ")
curl localhost:5000/costEstimation -X POST -H "Content-Type: application/json" -d "[
    {
        \"timestamp\": \"$TIME_A\",
        \"start\": {
            \"latitude\": 50.843052,
            \"longitude\": 4.443514
        },
        \"end\": {
            \"latitude\": 50.85,
            \"longitude\": 4.45
        }
    },
    {
        \"timestamp\": \"$TIME_B\",
        \"start\": {
            \"latitude\": 50.8475,
            \"longitude\": 4.4370
        },
        \"end\": {
            \"latitude\": 50.85,
            \"longitude\": 4.45
        }
    }
]"