# HelmIt API

An API which gives insight to running containers.

### GET `/shipment/status/:barge/:shipment/:environment`

> Returns an object that has the status of all containers running in the Shipment.


### GET `/shipment/events/:barge/:shipment/:environment`

> Returns an object with the events from all containers running in the Shipment.


## GET `/harbor/:barge/:shipment/:environment`

> Returns an object with an array of containers that have data to be displayed in the Harbor UI
> including the container logs.
