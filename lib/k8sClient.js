'use strict';

const k8s = require('k8s'),
    debug = require('debug')('helmit:k8sClient'),
    Promise = require('bluebird');

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
            status.host = item.status.hostIP;
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

//returns a k8s client based on a request
function getK8sClient(req) {

    //get the barge info from the req object (populated by barge.discover)
    const barge = req.helmit.bargeInfo;

    const conf = {
        endpoint: barge.endpoint,
        version: '/api/v1',
        strictSSL: false,
        auth: { token: barge.authToken }
    };

    const request = k8s.api(conf);

    return {
        get: (url) => {
            debug('\n\n getting %s%s/%s \n', conf.endpoint, conf.version, url)
            return request.get(url);
        },
        log: (url) => {
            debug('\n\n getting %s%s/%s \n', conf.endpoint, conf.version, url)
            return request.log(url);
        }
    }
}

module.exports = {

    podStatus: (req, res, next) => {
        let kube = getK8sClient(req),
            path = `namespaces/${req.params.shipment}-${req.params.environment}/pods`;

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
        let kube = getK8sClient(req),
            path = `namespaces/${req.params.shipment}-${req.params.environment}/events`;

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
        let kube = getK8sClient(req),
            path = `namespaces/${req.params.shipment}-${req.params.environment}/pods`;

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
    },

    podReplicas: (req, res, next) => {
        res.json({
            replicas: req.helmit.nodes,
            error: false
        })
    },

    //fetches container logs from the k8s api
    getLogs: (req, res, next) => {
        let kube = getK8sClient(req),
            logSize = process.env.HARBOR_LOG_SIZE || 500,
            ns = `${req.params.shipment}-${req.params.environment}`,
            logUrl = `namespaces/${ns}/pods/$POD/log?container=$CONTAINER&timestamps=true&tailLines=${logSize}`,
            result = { replicas: [], error: false };

        if (req.helmit.nodes.length) {
            debug('\n\n pods', req.helmit.nodes);

            //track async calls
            let promises = [];

            //iterate req.helmit.nodes which are pods replicas retrieved from k8s
            //only get logs for "running" containers
            req.helmit.nodes.filter(ele => ele.phase == "running").forEach(pod => {

                //iterate containers in pod
                pod.containers.forEach(container => {
                    let url = logUrl
                        .replace('$POD', pod.name)
                        .replace('$CONTAINER', container.name);

                    //kick off async call to fetch container logs
                    promises.push(fetchLogsAsync({ id: container.id, url: url, kube: kube }));
                });
            });

            //wait for all async calls to return, then stitch results together
            Promise.all(promises)
                .then(contexts => {
                    contexts.forEach(context => {
                        debug(`\n\n === processing results for ${context.url} ===`);

                        //find pod container that matches this context and update its logs property
                        req.helmit.nodes.forEach(pod => {
                            pod.containers.forEach(container => {
                                if (context.id === container.id) {
                                    container.logs = context.body;
                                    if (!context.success) {
                                        container.logs = `Failed to Get Container Logs Because: ${context.err}`;
                                    }
                                }
                            });
                        });
                    });

                    //return http response
                    next();
                })
                .catch(err => {
                    //at least one failed
                    let newErr = new Error(`error fetching container logs from k8s: ${err.message}`); console.error(newErr);
                    next(newErr);
                });
        }
        else {
            debug('no nodes', req.helmit.nodes);
            result.error = true;
            result.msg = 'Could not find Product';
            res.status(200);
            res.json(result);
        }
    }
};


//returns a promise that fetches logs, process results, and updates the context.body
function fetchLogsAsync(context) {
    return new Promise((resolve, reject) => {
        debug('fetchLogsAsync', context.url);
        context.kube.log(context.url)
            .then(data => {
                if (data) {
                    //split string into array of lines
                    context.body = [];
                    data.split('\n').forEach(line => {
                        if (line) context.body.push(line + '\n');
                    });
                    context.success = true;
                    resolve(context);
                }
            })
            .catch(err => {
                let newErr = new Error(`error fetching container logs from k8s: ${err.message}`);
                console.error(newErr)
                context.err = newErr;
                reject(newErr);
            });
    });
}