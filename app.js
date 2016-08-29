"use strict"

const cors = require('cors'),
    debug = require('debug')('helmit:app'),
    express = require('express'),
    morgan = require('morgan'),
    pkg = require('./package.json');

debug('%s v%s', pkg.name, pkg.version);

const handlers = require('./lib/handlers'),
    barge = require('./lib/barge'),
    k8sClient = require('./lib/k8sClient'),
    containers = require('./lib/containers');

let port = process.env.PORT || 5061,
    app = express();

app.set('x-powered-by', false);
app.set('etag', false);

app.use(cors());
app.use(handlers.contentJson);

app.get('/_hc', handlers.healthCheck);

app.use(morgan('common'));
app.use(handlers.appContext);

/* /shipment/status/:barge/:shipment/:environment
*/
app.get('/shipment/status/:barge/:shipment/:environment',
    barge.discover,
    k8sClient.podStatus
);

/* /shipment/events/:barge/:shipment/:environment
*/
app.get('/shipment/events/:barge/:shipment/:environment',
    barge.discover,
    k8sClient.podEvents
);

/* /harbor/:customer/:shipment/:environment
*/
app.get('/harbor/:barge/:shipment/:environment',
    barge.discover,
    k8sClient.getPods,
    containers.getLogs
);

app.use(handlers.errors);

let server = app.listen(port, () => {
    debug('listening on %s', port)
});

module.exports = server;
