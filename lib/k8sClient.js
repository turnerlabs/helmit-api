'use strict';

const k8s = require('k8s'),
    debug = require('debug')('helmit:k8sClient');

function statusTransform(data) {
    let result = {},
        totalRestarts = 0,
        replicas = data.items.length;

    result.namespace = data.metadata.selfLink.split('/')[4];
    result.version = data.metadata.resourceVersion;
    result.status = {
        phase: 'Unknown',
        conditions: [],
        containers: []
    };

    // each item represents a replica
    data.items.forEach(item => {
        if (result.status.phase === 'Unknown' || item.status.phase !== 'Running') {
            // Haven't set the status yet, take any value
            // Or we aren't "Running" so take that value
            result.status.phase = item.status.phase;
        }

        item.status.conditions.forEach(condition => {
            if (condition.type === 'Ready' && condition.status === 'True') {
                // Boring, everything is working fine
            } else {
                result.status.conditions.push(condition);
            }
        })

        item.status.containerStatuses.forEach(container => {
            let status = {};

            status.image = container.image;
            status.ready = container.ready;
            status.restarts = container.restartCount;
            status.state = container.state;
            status.status = Object.keys(container.state)[0];

            if (container.lastState) {
                status.lastState = container.lastState;
            }

            totalRestarts += container.restartCount;
            result.status.containers.push(status);
        })
    })

    result.averageRestarts = totalRestarts / replicas;

    return result;
}

function eventsTransform(data) {
    let result = {};

    result.namespace = data.metadata.selfLink.split('/')[4];
    result.version = data.metadata.resourceVersion;
    result.events = [];

    data.items.forEach(evt => {
        var temp = {
                type: evt.type,
                count: evt.count,
                reason: evt.reason,
                message: evt.message,
                source: evt.source
            };

        result.events.push(temp);
    });

    return result;
}

module.exports = {
    podStatus: (req, res, next) => {
        let apiHost = req.helmit.discovedHosts[0],
            path = `namespaces/${req.params.shipment}-${req.params.environment}/pods`,
            kube = k8s.api({
                endpoint: apiHost,
                version: 'v1'
            });

        debug('status url %s/api/v1/%s', apiHost, path);

        kube.get(path)
            .then(data => {
                debug('raw pod status data', data);
                data = statusTransform(data);
                debug('transformed pod status data', data);
                res.json(data);
            })
            .catch(err => next(err));
    },

    podEvents: (req, res, next) => {
        let apiHost = req.helmit.discovedHosts[0],
            path = `namespaces/${req.params.shipment}-${req.params.environment}/events`,
            kube = k8s.api({
                endpoint: apiHost,
                version: 'v1'
            });

        debug('events url %s/api/v1/%s', apiHost, path);

        kube.get(path)
            .then(data => {
                debug('raw pod events data', data);
                data = eventsTransform(data);
                debug('transformed pod events data', data);
                res.json(data);
            })
            .catch(err => next(err));
    },

    getPods: (req, res, next) => {
        let apiHost = req.helmit.discovedHosts[0],
            path = `namespaces/${req.params.shipment}-${req.params.environment}/pods`,
            kube = k8s.api({
                endpoint: apiHost,
                version: 'v1'
            });

        debug('pods url %s/api/v1/%s', apiHost, path);

        kube.get(path)
            .then(data => {
                debug('raw pod data', data);
                let pods = data.items.filter(ele => ele.status.phase == "Running").map(item => {
                    let obj = {};

                    obj.host = item.status.hostIP;
                    obj.provider = process.env.LOCATION || 'ec2';
                    obj.containers = item.status.containerStatuses.map(status => {
                        let obj = {};

                        obj.id = status.containerID.replace('docker://', '');
                        obj.name = status.name;
                        obj.image = status.image;

                        return obj;
                    });

                    debug('pod obj', obj);
                    return obj;
                });

                req.helmit.nodes = pods;
                next();
            })
            .catch(err => next(err));
    }
};
