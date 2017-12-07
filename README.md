# HelmIt API

An API which gives insight to running containers.

[![CircleCI](https://circleci.com/gh/turnerlabs/helmit-api/tree/master.svg?style=svg)](https://circleci.com/gh/turnerlabs/helmit-api/tree/master)

### GET `/shipment/status/:barge/:shipment/:environment`

> Returns an object that has the status of all containers running in the Shipment.

```json
{
    "error": "<boolean:is the response an error>",
    "replicas": [
        {
            "host": "<string:host ip address>",
            "name": "<string:name of kube deployment>",
            "phase": "<string:lifecycle phase of kube pod>",
            "provider": "<string:provider of the hosts>",
            "containers": [
                {
                    "id": "<string:docker container id>",
                    "name": "<string:product name>",
                    "image": "<string:docker image>",
                    "state": "<string:container status>",
                    "restartCount": "<number:number of times container has been restarted>",
                    "log_stream": "<string:url to stream logs>",
                    "logs": [
                        "<string:log entry/entries>"
                    ]
                }
            ]
        }
    ]
}
```


### GET `/shipment/events/:barge/:shipment/:environment`

> Returns an object with the events from all containers running in the Shipment.

```json
{
    "namespace": "<string:namespace of the kube deployment; shipment name + environment>",
    "version": "<string:version of the kube deployment>",
    "status": {
        "phase": "<string:lifecycle phase of kube pod>",
        "conditions": [
            "<object:information about the conditions, includes 'type', 'status', and timing data.>"
        ],
        "containers": [
            {
                "id": "<string:docker container id>",
                "host": "<string:host ip address>",
                "podIp": "<string:docker container ip address>",
                "replica": "<string:name of kube deployment>",
                "image": "<string:docker image>",
                "ready": "<boolean:ready state>",
                "restarts": "<number:number of times container has been restarted>",
                "state": "<object:information about the state of the container (waiting, running, terminated)>",
                "status": "<string:current status of kube deployment>",
                "lastState": "<object:details about the container's last terminated condition>"
            }
        ]
    },
    "averageRestarts": "<number:average number of restarts across all containers in shipment>"
}
```


### GET `/harbor/:barge/:shipment/:environment`

> Returns an object with an array of containers that have data to be displayed in the Harbor UI
> including the container logs.

```json
{
    "error": "<boolean:is the response an error>",
    "replicas": [
        {
            "host": "<string:host ip address>",
            "name": "<string:name of kube deployment>",
            "phase": "<string:lifecycle phase of kube pod>",
            "provider": "<string:provider of the hosts>",
            "containers": [
                {
                    "id": "<string:docker container id>",
                    "name": "<string:product name>",
                    "image": "<string:docker image>",
                    "state": "<string:container status>",
                    "restartCount": "<number:number of times container has been restarted>",
                    "log_stream": "<string:link to streaming endpoint>",
                    "logs": [
                       "<string:container's stdout>"
                    ]                    
                }
            ]
        }
    ]
}
```

### GET `/v2/harbor/:barge/:shipment/:environment`

> Returns container replicas and related info, excluding logs

```json
{
    "error": "<boolean:is the response an error>",
    "replicas": [
        {
            "host": "<string:host ip address>",
            "name": "<string:name of kube deployment>",
            "phase": "<string:lifecycle phase of kube pod>",
            "provider": "<string:provider of the hosts>",
            "containers": [
                {
                    "id": "<string:docker container id>",
                    "name": "<string:product name>",
                    "image": "<string:docker image>",
                    "state": "<string:container status>",
                    "restartCount": "<number:number of times container has been restarted>",
                }
            ]
        }
    ]
}
```

### GET `/v2/harbor/logs/:barge/:shipment/:environment`

> Returns container replicas and related info, including latest logs

```json
{
    "error": "<boolean:is the response an error>",
    "replicas": [
        {
            "host": "<string:host ip address>",
            "name": "<string:name of kube deployment>",
            "phase": "<string:lifecycle phase of kube pod>",
            "provider": "<string:provider of the hosts>",
            "containers": [
                {
                    "id": "<string:docker container id>",
                    "name": "<string:product name>",
                    "image": "<string:docker image>",
                    "state": "<string:container status>",
                    "restartCount": "<number:number of times container has been restarted>",
                    "logs": [
                       "<string:container's stdout>"
                    ]
                }
            ]
        }
    ]
}
```



## Contributing

Develop [![CircleCI](https://circleci.com/gh/turnerlabs/helmit-api/tree/master.svg?style=svg)](https://circleci.com/gh/turnerlabs/helmit-api/tree/develop)

This repository uses [Git Flow](http://nvie.com/posts/a-successful-git-branching-model/). All new
features should branch off of `develop` and all pull requests should be back into `develop`. Version
bumps will occur when the feature is merged into master.

Make sure to add tests for new features.
