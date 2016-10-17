# HelmIt API

An API which gives insight to running containers.

[![CircleCI](https://circleci.com/gh/turnerlabs/helmit-api/tree/master.svg?style=svg)](https://circleci.com/gh/turnerlabs/helmit-api/tree/master)

### GET `/shipment/status/:barge/:shipment/:environment`

> Returns an object that has the status of all containers running in the Shipment.


### GET `/shipment/events/:barge/:shipment/:environment`

> Returns an object with the events from all containers running in the Shipment.


## GET `/harbor/:barge/:shipment/:environment`

> Returns an object with an array of containers that have data to be displayed in the Harbor UI
> including the container logs.


## Contributing

Develop [![CircleCI](https://circleci.com/gh/turnerlabs/helmit-api/tree/master.svg?style=svg)](https://circleci.com/gh/turnerlabs/helmit-api/tree/develop)
This repository uses [Git Flow](http://nvie.com/posts/a-successful-git-branching-model/). All new
features should branch off of `develop` and all pull requests should be back into `develop`. Version
bumps will occur when the feature is merged into master.

Make sure to add tests for new features.
