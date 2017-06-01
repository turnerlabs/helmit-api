'use strict';

const k8s = require('k8s'),
    debug = require('debug')('helmit:k8sClient');
var STRICT_SSL = process.env.STRICT_SSL || 'doc,iso';
var AUTH_TOKEN = process.env.AUTH_TOKEN || '';

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

            if (container.containerID) {
                status.id = container.containerID.replace('docker://', '');
            } else {
                status.id = 'pending';
            }
            status.host  = item.status.hostIP;
            status.podIp = item.status.podIP || null;
            status.replica = item.metadata.name;
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
    result.events = data.items.map(evt => {
        return {
            type: evt.type,
            count: evt.count,
            reason: evt.reason,
            message: evt.message,
            source: evt.source,
            firstTimestamp: evt.firstTimestamp,
            lastTimestamp: evt.lastTimestamp
        };
    });

    return result;
}

module.exports = {
    podStatus: (req, res, next) => {
        let apiHost = req.helmit.discovedHosts[0],
            path = `namespaces/${req.params.shipment}-${req.params.environment}/pods`,
            kube = k8s.api({
                endpoint: apiHost,
                version: '/api/v1',
                strictSSL: false,
                auth: {
                  "token": AUTH_TOKEN
                }
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
                version: '/api/v1',
                strictSSL: false,
                auth: {
                  "token": AUTH_TOKEN
                }
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
                version: '/api/v1',
                strictSSL: false,
                auth: {
                  "token": AUTH_TOKEN
                }
            });

        debug('pods url %s/api/v1/%s', apiHost, path);

        kube.get(path)
            .then(data => {
                debug('raw pod data', data);
                let pods = data.items.map(item => {
                    let obj = {};

                    obj.host = item.status.hostIP;
                    obj.name = item.metadata.name;
                    obj.phase = item.status.phase.toLowerCase();
                    obj.provider = process.env.LOCATION || 'ec2';
                    obj.containers = item.status.containerStatuses.map(status => {
                        let obj = {};

                        if (status.containerID) {
                            obj.id = status.containerID.replace('docker://', '');
                        } else {
                            obj.id = 'pending';
                        }
                        obj.name = status.name;
                        obj.image = status.image;
                        obj.state = Object.keys(status.state)[0];
                        obj.restartCount = status.restartCount;

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
