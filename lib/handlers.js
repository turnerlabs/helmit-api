'use strict';

const pkg = require('../package.json');

module.exports = {
    appContext: (req, res, next) => {
        req.helmit = {};
        next();
    },

    contentJson: (req, res, next) => {
        res.header('Content-Type', 'application/json');
        next();
    },

    healthCheck: (req, res) => res.json({version: pkg.version})
};
