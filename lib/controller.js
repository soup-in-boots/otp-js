"use strict";


const Process = require('./process.js'),
      Serialize = require('./serialize.js'),
      cluster = require('cluster'),
      os = require('os'),
      path = require('path');

class Controller {
    constructor(schedulers) {
        schedulers = schedulers || os.numCPUs();
        this.__schedulers = [];
        this.__schedulerIDs = new Map();
        this.__schedulerIndex = 0;
        this.__requestCount = 0;
        this.__requestResolvers = new Map();

        cluster.setupMaster({
            exec: path.join(__dirname, '/scheduler-cli.js'),
            args: []
        });

        for (var i = 0; i < schedulers; ++i) {
            var scheduler = cluster.fork();
            this.__schedulers.push(scheduler);
            this.__schedulerIDs.set(scheduler.process.pid, scheduler);
            scheduler.on('message', this.__handleMessage.bind(this, scheduler));
        }
    }

    spawn(module) {
        var selectedScheduler = this.__nextScheduler,
            scheduler = this.__schedulers[selectedScheduler];

        return this.__call(scheduler, 'spawn', [module, true]);
    }

    send(pid, message) {
        var scheduler = this.__schedulerIDs.get(pid.schedulerID);
        this.__cast(scheduler, 'send', [pid, message]);
    }

    inspectProcess(pid, property) {
        var scheduler = this.__schedulerIDs.get(pid.schedulerID);
        return this.__call(scheduler, 'inspectProcess', [pid, property]);
    }

    __call(scheduler, op, args) {
        return new Promise((resolve) => {
            var requestID = this.__requestCount++;
            this.__requestResolvers.set(requestID, resolve);

            scheduler.send(Serialize.stringify({
                'system':   Process.SYSTEM,
                'op':       op,
                'req':      requestID,
                'args':     args
            }));
        });
    }

    __cast(scheduler, op, args) {
        scheduler.send(Serialize.stringify({
            'system': Process.SYSTEM,
            'op': op,
            'args': args
        }));
    }

    __handleMessage(scheduler, message) {
        message = Serialize.parse(message);
        if (message.system === Process.SYSTEM) {
            return this.__handleSystemMessage(scheduler, message);
        }
        if (message.req !== undefined && this.__requestResolvers.has(message.req)) {
            var resolve = this.__requestResolvers.get(message.req);
            this.__requestResolvers.delete(message.req);
            return resolve(message.payload);
        }
    }

    __handleSystemMessage(scheduler, message) {
        var res = this[message.op](...message.args);
        if (message.req !== undefined) {
            if (res instanceof Promise) {
                return res.then(this.__reply.bind(this, scheduler, message.req));
            }
            this.__reply(scheduler, message.req, res);
        }
    }

    __reply(scheduler, reqID, response) {
        scheduler.send(Serialize.stringify({
            'req': reqID,
            'payload': response
        }));
    }

    get __nextScheduler() {
        var index = this.__schedulerIndex++ % this.__schedulers.length;
        return index;
    }
}

module.exports = Controller;
