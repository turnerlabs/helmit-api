'use strict';

const debug = require('debug')('helmit:barge');
const cache = require('./cache');

function getBargeInfo(barge) {
    //look for endpoint/token envvars for this barge
    let bargeEnvVar = barge.replace('-', '_').toUpperCase();
    return {
        barge: barge,
        endpoint: process.env[`${bargeEnvVar}_ENDPOINT`],
        authToken: process.env[`${bargeEnvVar}_TOKEN`],
        argoManaged: false,
    }
}

module.exports = {
    discover: (req, res, next) => {

        //look for managed kubernetes info for this barge
        const bargeInfo = getBargeInfo(req.params.barge);
        if (bargeInfo.endpoint) {
            debug(`found k8s endpoint: ${bargeInfo.endpoint} for barge: ${req.params.barge}`)

            //store barge info in req object
            req.helmit.bargeInfo = {
                barge: bargeInfo.barge,
                endpoint: bargeInfo.endpoint,
                authToken: bargeInfo.authToken,
                argoManaged: bargeInfo.argoManaged
            };
            next();
        } else {

            //no managed endpoint found so fallback to discover process
            let barge = `${req.params.barge}-barge-api`,
                location = process.env.LOCATION || 'ec2',
                environment = 'prod',
                key = `${barge}-${environment}-${location}`,
                cached = cache.get(key);

            debug('discover(%s, %s, %s)', barge, environment, location);
            req.helmit = req.helmit || {};

            //store barge info in req
            req.helmit.bargeInfo = {
                barge: req.params.barge,
                argoManaged: true,
                //use global AUTH_TOKEN envvar as the k8s token for argo managed clusters
                authToken: process.env.AUTH_TOKEN
            };

            //look for cached endpoint
            if (typeof cached !== 'undefined') {
                debug('discover: cache returned', cached);
                req.helmit.bargeInfo.endpoint = cached[0];
                next();
            } else {
                require('argo-discover')(barge, environment, location).then(
                    (data) => {
                        if (data.length) {
                            debug('discover: returned', data);
                            cache.set(key, data);
                            req.helmit.bargeInfo.endpoint = data[0];
                            next();
                        } else {
                            next(new Error(`No barges returned for ${barge} ${environment} ${location}`));
                        }
                    },
                    (reason) => {
                        debug('discover: errored', reason);
                        delete req.helmit.bargeInfo;
                        next(reason);
                    }
                );
            }
        }
    }
};
