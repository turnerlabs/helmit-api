'use strict';

const debug = require('debug')('helmit:cache');

let cache = {},
    ttl = process.env.HELMIT_CACHE_TTL || 1000 * 60 * 5; // defaults to 5 minutes

function clearCache() {
    let keys = Object.keys(cache),
        now = (new Date()).getTime();

    keys.forEach(key => {
        if (now > cache[key].ttl) {
            delete cache[key];
        }
    });
}

module.exports = {
    set: (key, value) => {
        cache[key] = {
            ttl: (new Date()).getTime() + ttl,
            val: value
        }

        return true;
    },

    get: key => cache[key] ? cache[key].val : undefined
};

setInterval(clearCache, 1000);
