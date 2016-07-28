const Controller    = require('../lib/controller.js'),
      Process       = require('../lib/process.js'),
      cluster       = require('cluster'),
      expect        = require('chai').expect,
      path          = require('path'),
      os            = require('os');

const TEST_MODULE = path.resolve(path.join(__dirname, "/mock/basic_init_module.js"));

Error.stackTraceLimit = Infinity;

process.on('uncaughtException', (e) => console.log(e));

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function random() {
    return Math.floor(Math.random() * 999999999999);
}

describe("Controller", function() {
    var numCPUs = os.cpus().length,
        controller;

    // Lie so we can test multithreading
    if (numCPUs == 1) numCPUs = 2;

    before(function() {
        Object.keys(require.cache).forEach((key) => delete require.cache[key]);
        controller = new Controller(numCPUs);
    });

    it("runs one scheduler for each CPU core", function() {
        expect(controller.__schedulers.length).to.be.equal(numCPUs);
    });

    it("can spawn processes", function() {
        return controller.spawn(TEST_MODULE).then(function(pid) {
            expect(pid).to.be.an.instanceOf(Process.Identifier);
        });
    });

    it("spreads processes over schedulers", function() {
        return Promise.all([
                controller.spawn(TEST_MODULE),
                controller.spawn(TEST_MODULE)
        ]).then(function([pidA, pidB]) {
            expect(pidA.schedulerID).to.not.be.equal(pidB.schedulerID);
        });
    });

    it("can send messages via pid", function() {
        return controller.spawn(TEST_MODULE).then(function(pid) {
            expect(function() {
                controller.send(pid, {});
            }).to.not.throw(Error);
        });
    });

    it("can query for process context values", function() {

        var message = random(),
            pid;
        return controller.spawn(TEST_MODULE).then(function(pid) {
            controller.send(pid, {
                'op': 'set-value',
                'name': 'state',
                'value': message
            });

            return wait(10).then(() => pid);
        }).then((pid) => controller.inspectProcess(pid, 'state'))
        .then(function(state) {
            expect(state).to.be.equal(message);
        });
    });

    it("routes messages for schedulers", function() {
        var message = random();
        return Promise.all([
                controller.spawn(TEST_MODULE),
                controller.spawn(TEST_MODULE)
        ]).then(function([pidA, pidB]) {
            controller.send(pidA, {
                'op': 'send-set-value',
                'target': pidB,
                'name': 'state',
                'value': message
            });

            return wait(10).then(() => pidB);
        }).then(function(pidB) {
            return controller.inspectProcess(pidB, 'state');
        }).then(function(state) {
            expect(state).to.be.equal(message);
        });
    });

    it("can spawn processes for other processes", function() {
        var message = random();
        return controller.spawn(TEST_MODULE).then(function(pid) {
            controller.send(pid, {
                'op': 'spawn',
                'handler': TEST_MODULE
            });

            return wait(10).then(() => pid)
        }).then(function(pid) {
            return controller.inspectProcess(pid, 'spawned')
        }).then(function(pid) {
            expect(pid).to.be.an.instanceOf(Process.Identifier);
            controller.send(pid, {'op':'set-value', 'name':'state', 'value':message});
            return controller.inspectProcess(pid, 'state');
        }).then(function(state) {
            expect(state).to.be.equal(message);
        });
    });
});
