const Process = require('./process.js'),
      Serialize = require('./serialize.js');

class Scheduler {
    constructor() {
        this.__id = process.pid;
        this.__processCount = 0;
        this.__processes = new Map();
        this.__requestCount = 0;
        this.__requestResolvers = new Map();

        process.stdin.setEncoding('utf8');
        process.on('message', (message) => {
            message = Serialize.parse(message);
            if (message.system === Process.SYSTEM) {
                var result;
                try {
                    result = this[message.op](...message.args);
                } catch(e) {
                    result = e;
                }

                if (message.req !== undefined) {
                    if (result instanceof Promise) {
                        return result.then(this.__reply.bind(this, message.req))
                            .catch(this.__reply.bind(this, message.req));
                    }
                    return this.__reply(message.req, result);
                }
            }

            if (message.req !== undefined && this.__requestResolvers.has(message.req)) {
                var resolve = this.__requestResolvers.get(message.req);
                this.__requestResolvers.delete(message.req);
                resolve(message.payload);
            }
        });
    }

    spawn(module, system) {
        if (system) return this.__systemSpawn(module);

        return new Promise((resolve) => {
            var reqID = this.__requestCount++;
            var message = {
                'system': Process.SYSTEM,
                'req': reqID,
                'op': 'spawn',
                'args': [module]
            };

            this.__requestResolvers.set(reqID, resolve);
            process.send(Serialize.stringify(message));
        });
    }

    __systemSpawn(module) {
        var pid = new Process.Identifier(this.__id, this.__processCount++),
            proc = new Process(pid, module, this);

        this.__processes.set(pid.procID, proc);

        return pid;
    }

    send(pid, message) {
        if (pid.schedulerID == this.__id) {
            var proc = this.__find(pid);
            if (proc == null) throw new Error("No such process");
            return proc.__give(message);
        }

        var systemMessage = {
            'system': Process.SYSTEM,
            'op': 'send',
            'args': [pid, message]
        };

        process.send(Serialize.stringify(systemMessage));
    }

    inspectProcess(pid, property) {
        var proc = this.__find(pid);
        if (proc == null) throw new Error("No such process");
        return proc.__context[property];
    }

    __find(pid) {
        var procID = pid.procID;
        if (this.__processes.has(procID))
            return this.__processes.get(procID);

        return null;
    }

    __reply(requestID, response) {
        process.send(Serialize.stringify({
            req: requestID,
            payload: response
        }));
    }
}

module.exports = Scheduler;
