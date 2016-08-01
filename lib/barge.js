'use strict';

const debug = require('debug')('helmit:barge');
const cache = require('./cache');

module.exports = {
    discover: (req, res, next) => {
        let barge = `${req.params.barge}-barge-api`,
            location = process.env.LOCATION || 'ec2',
            environment = 'prod',
            key = `${barge}-${environment}-${location}`,
            cached = cache.get(key);

        debug('discover(%s, %s, %s)', barge, environment, location);
        req.helmit = req.helmit || {};

        if (typeof cached !== 'undefined') {
            debug('discover: cache returned', cached);
            req.helmit.discovedHosts = cached;
            next();
        } else {
            require('argo-discover')(barge, environment, location).then(
                (data) => {
                    debug('discover: returned', data);
                    cache.set(key, data);
                    req.helmit.discovedHosts = data;
                    next();
                },
                (reason) => {
                    debug('discover: errored', reason);
                    req.helmit.discovedHosts = null;
                    next(reason);
                }
            );
        }
    }
};
