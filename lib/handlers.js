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

    errors: (err, req, res, next) => res.status(err ? 500 : 400).json({error: true, message: err || "Something went wrong"}),

    healthCheck: (req, res) => res.json({version: pkg.version})
};
