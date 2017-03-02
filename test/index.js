/*global before, describe, it */
'use strict'

const fs = require('fs'),
    expect = require('chai').expect,
    request = require('supertest'),
    nock = require('nock');

let server = require('../app.js'),
    idbHost = 'http://idb.services.dmtio.net',
    idbPath = '/instances/$PRODUCT/$ENVIRONMENT?q=location:$LOCATION+AND+NOT+offline:true',
    mssBargeApi = 'http://101.0.0.1:5000';

function getMockData(name) {
    return `${__dirname}/mocks/${name}.json`;
}

function getTextFile(name) {
    return fs.readFileSync(`${__dirname}/mocks/${name}.txt`);
}
/*
 * Mixing the use of arrow functions because Mocha can't use them,
 * but I like them, so using them where I can.
 * http://mochajs.org/#arrow-functions
 */
describe('Health check', function () {
    it('should return successfully', function (done) {
        request(server)
            .get('/_hc')
            .expect('Content-Type', /json/)
            .expect(200, done);
    });
});

describe('Harbor Endpoint', function () {
    // Setup
    let barge = 'mss',
        shipment = 'foobar-app',
        environment = 'dev',
        location = 'ec2',
        shipmentStatusPath = '/api/v1/namespaces/$NAMESPACE/pods',
        containerPath = '/containers/$ID/logs',
        host1 = 'http://172.0.0.1:4545',
        host2 = 'http://172.0.0.2:4545';

    beforeEach(function () {
        nock(idbHost)
            .get(idbPath.replace('$PRODUCT', `${barge}-barge-api`).replace('$ENVIRONMENT', 'prod').replace('$LOCATION', location))
            .replyWithFile(200, getMockData('barge-discover'));

        nock(mssBargeApi)
            .get(shipmentStatusPath.replace('$NAMESPACE', `${shipment}-${environment}`))
            .replyWithFile(200, getMockData('harbor/pod'));

        nock(mssBargeApi)
            .get(shipmentStatusPath.replace('$NAMESPACE', `missing-shipment-${environment}`))
            .replyWithFile(200, getMockData('harbor/missing'));

        nock(host1)
            .get(containerPath.replace('$ID', 'd92a1'))
            .query({stdout: 1, stderr: 1, timestamps: 1, tail: 500})
            .reply(200, getTextFile('harbor/host1-container1'));

        nock(host1)
            .get(containerPath.replace('$ID', 'd69a1'))
            .query({stdout: 1, stderr: 1, timestamps: 1, tail: 500})
            .reply(200, getTextFile('harbor/host1-container2'));

        nock(host2)
            .get(containerPath.replace('$ID', 'd92a2'))
            .query({stdout: 1, stderr: 1, timestamps: 1, tail: 500})
            .reply(200, getTextFile('harbor/host2-container1'));

        nock(host2)
            .get(containerPath.replace('$ID', 'd69a2'))
            .query({stdout: 1, stderr: 1, timestamps: 1, tail: 500})
            .reply(200, getTextFile('harbor/host2-container2'));
    });

    it('should return a json object with data for Harbor UI', function (done) {
        request(server)
            .get(`/harbor/${barge}/${shipment}/${environment}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
                if (err) {
                    done(err);
                }

                let obj = res.body,
                    required = ['error', 'replicas'],
                    reqReplicas = ['host', 'provider', 'containers', 'phase', 'name'],
                    reqRunningContainers = ['name', 'id', 'image', 'log_stream', 'logs', 'state', 'restartCount'],
                    reqNonRunningContainers = ['name', 'id', 'image', 'state', 'restartCount'];

                required.forEach(prop => expect(obj).to.have.property(prop));

                // replicas
                expect(obj.replicas).to.have.length.of.at.least(1);
                expect(obj.error).to.be.false;
                obj.replicas.forEach(replica => {
                    reqReplicas.forEach(prop => expect(replica).to.have.property(prop))

                    // containers
                    expect(replica.containers).to.have.length.of.at.least(1);
                    // running container
                    replica.containers.filter(container => container.phase === 'running').forEach(container => {
                        reqRunningContainers.forEach(prop => expect(container).to.have.property(prop))

                        // logs
                        expect(container.logs).to.be.instanceof(Array);
                    });
                    replica.containers.filter(container => container.phase !== 'running').forEach(container => {
                        reqNonRunningContainers.forEach(prop => expect(container).to.have.property(prop))
                    });
                });

                done();
            });
    });

    it('should return failure when product is not found', function (done) {
        request(server)
            .get(`/harbor/${barge}/missing-shipment/${environment}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
                if (err) {
                    done(err);
                }

                let obj = res.body;

                expect(obj.replicas).to.have.length.of(0);
                expect(obj.msg).to.equal('Could not find Product')
                expect(obj.error).to.be.false;

                done();
            });
    });
});

describe('Shipment Status', function () {
    let barge = 'mss',
        shipment = 'hello-world-app',
        environment = 'dev',
        location = 'ec2',
        shipmentStatusPath = '/api/v1/namespaces/$NAMESPACE/pods';

    beforeEach(function () {
        nock(idbHost)
            .get(idbPath.replace('$PRODUCT', `${barge}-barge-api`).replace('$ENVIRONMENT', 'prod').replace('$LOCATION', location))
            .replyWithFile(200, getMockData('barge-discover'));

        nock(mssBargeApi)
            .get(shipmentStatusPath.replace('$NAMESPACE', `${shipment}-${environment}`))
            .replyWithFile(200, getMockData('shipment-status/pod'));

        nock(mssBargeApi)
            .get(shipmentStatusPath.replace('$NAMESPACE', `broken-shipment-${environment}`))
            .replyWithFile(200, getMockData('shipment-status/pod-broken'));

        nock(mssBargeApi)
            .get(shipmentStatusPath.replace('$NAMESPACE', `empty-shipment-${environment}`))
            .replyWithFile(200, getMockData('shipment-status/pod-empty'));
    });

    it('should return a json object on the status endpoint', function (done) {
        request(server)
            .get(`/shipment/status/${barge}/${shipment}/${environment}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
                if (err) {
                    done(err)
                }

                let obj = res.body,
                    required = ['averageRestarts', 'status', 'namespace', 'version'],
                    reqStatus = ['conditions', 'containers', 'phase'],
                    reqContainers = ['host', 'id', 'image', 'ready', 'replica', 'restarts', 'state', 'status'];

                required.forEach(prop => expect(obj).to.have.property(prop));
                reqStatus.forEach(prop => expect(obj.status).to.have.property(prop));
                expect(obj.status.conditions).to.have.length.of(0);
                expect(obj.status.containers).to.have.length.of.at.least(1);
                obj.status.containers.forEach(container => {
                    reqContainers.forEach(prop => expect(container).to.have.property(prop));
                });

                done();
            });
    });

    it('should return a conditions array when shipment is broken', function (done) {
        request(server)
            .get(`/shipment/status/${barge}/broken-shipment/${environment}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
                if (err) {
                    done(err)
                }

                let obj = res.body,
                    reqConditions = ['message', 'reason', 'status', 'type'];

                expect(obj.status.conditions).to.have.length.of.at.least(1);
                obj.status.conditions.forEach(condition => {
                    reqConditions.forEach(prop => expect(condition).to.have.property(prop));
                });

                done();
            });
    });

    it('should return an empty array when shipment cannot be found', function (done) {
        request(server)
            .get(`/shipment/status/${barge}/empty-shipment/${environment}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
                if (err) {
                    done(err)
                }

                let obj = res.body;
                expect(obj.status.phase).to.equal('Unknown');
                expect(obj.status.containers.length).to.equal(0);
                done();
            });
    });
});

describe('Shipment Events', function () {
    let barge = 'mss',
        shipment = 'hello-world-app',
        environment = 'dev',
        location = 'ec2',
        shipmentEventsPath = '/api/v1/namespaces/$NAMESPACE/events';

    beforeEach(function () {
        nock(idbHost)
            .get(idbPath.replace('$PRODUCT', `${barge}-barge-api`).replace('$ENVIRONMENT', 'prod').replace('$LOCATION', location))
            .replyWithFile(200, getMockData('barge-discover'));

        nock(mssBargeApi)
            .get(shipmentEventsPath.replace('$NAMESPACE', `${shipment}-${environment}`))
            .replyWithFile(200, getMockData('shipment-events/events'));

        nock(mssBargeApi)
            .get(shipmentEventsPath.replace('$NAMESPACE', `empty-shipment-${environment}`))
            .replyWithFile(200, getMockData('shipment-events/events-empty'));
    });

    it('should return a json object on the events endpoint', function (done) {
        request(server)
            .get(`/shipment/events/${barge}/${shipment}/${environment}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
                if (err) {
                    done(err)
                }

                let obj = res.body,
                    required = ['type', 'count', 'reason', 'message', 'source'];

                expect(obj.namespace).to.equal('hello-world-app-dev');
                expect(obj.events).to.have.length.of.at.least(1);
                obj.events.forEach(evt => {
                    required.forEach(prop => {
                        expect(evt).to.have.property(prop);
                    });
                });

                done();
            });
    });

    it('should return an empty array when there are no events', function (done) {
        request(server)
            .get(`/shipment/events/${barge}/empty-shipment/${environment}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
                if (err) {
                    done(err)
                }

                let obj = res.body;

                expect(obj.events).to.have.length.of(0);

                done();
            });
    });
});

describe('Barge', function () {
    let barge = 'missing',
        shipment = 'hello-world-app',
        environment = 'dev',
        location = 'ec2',
        shipmentEventsPath = '/api/v1/namespaces/$NAMESPACE/events';

    beforeEach(function () {
        nock(idbHost)
            .get(idbPath.replace('$PRODUCT', `${barge}-barge-api`).replace('$ENVIRONMENT', 'prod').replace('$LOCATION', location))
            .replyWithFile(200, getMockData('missing-barge'));

        nock(mssBargeApi)
            .get(shipmentEventsPath.replace('$NAMESPACE', `${shipment}-${environment}`))
            .replyWithFile(200, getMockData('shipment-events/events'));

        nock(mssBargeApi)
            .get(shipmentEventsPath.replace('$NAMESPACE', `empty-shipment-${environment}`))
            .replyWithFile(200, getMockData('shipment-events/events-empty'));
    });

    it('should fail when barge is missing', function (done) {
        request(server)
            .get(`/shipment/events/${barge}/${shipment}/${environment}`)
            .expect('Content-Type', /json/)
            .expect(500, done);
    });
});
