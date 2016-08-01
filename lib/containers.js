'use strict';

const debug = require('debug')('helmit:containers'),
    Promise = require('bluebird'),
    http = require('http');

const fetch = context => {
    return new Promise((resolve, reject) => {
        debug('fetch', context.id);

        let request = http.get(context.url, response => {
            if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new Error(`HTTP Fetch Error ${response.statusCode}`));
            }
            let body = [];
            response.setEncoding('utf8');
            response.on('data', chunk => body.push(chunk));
            response.on('end', _ => {
                debug('fetch end', context.id);
                // get the body by filtering out the header lines, join together then spliting on new
                // lines so that we don't get awkward breaks
                context.body = body.filter(line => !/^[\x00\x01\x02].*/.test(line)).join('').split('\n');
                resolve(context);
            });
        });
        request.on('error', err => reject(err));
    });
};

module.exports = {
    getLogs: (req, res, next) => {
        let logSize = process.env.HARBOR_LOG_SIZE || 500,
            containerPort = process.env.CONTAINER_API_PORT || 4545,
            logUrl = 'http://$HOST:$PORT/containers/$ID/logs?stdout=1&stderr=1&timestamps=1&tail=$SIZE',
            logStream = '$LOG_URL&follow=1',
            result = {error: false, replicas: []},
            contexts = [];

        logUrl = logUrl.replace('$PORT', containerPort).replace('$SIZE', logSize);

        debug('nodes', req.helmit.nodes);

        req.helmit.nodes.forEach(node => {
            node.containers.forEach(container => {
                let url = logUrl
                    .replace('$HOST', node.host)
                    .replace('$ID', container.id);

                container.log_stream = logStream.replace('$LOG_URL', url);
                container.logs = [];

                contexts.push({id: container.id, url: url});
            });
        });

        Promise.map(contexts, context => {
                debug('log context', context);
                return fetch(context);
            })
            .then(contexts => {
                // Context is a array of objects with two fields
                // Field 1 is id: which maps to the container id
                // Field 2 is body: which are the logs
                // Need to go through each context and put it into place
                // on the helmit.nodes object
                // Then that object is placed into the result
                debug('cycling contexts (length %s)', contexts.length);
                contexts.forEach(context => {
                    req.helmit.nodes.forEach(node => {
                        node.containers.forEach(container => {
                            if (context.id === container.id) {
                                container.logs = context.body;
                            }
                        });
                    });
                });

                result.replicas = req.helmit.nodes;
                res.json(result);
            })
            .catch(err => next(err));
    }
};
