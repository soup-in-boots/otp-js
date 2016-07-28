const Scheduler = require('../lib/scheduler.js'),
      Process   = require('../lib/process.js'),
      expect    = require('chai').expect,
      path      = require('path');

const TEST_MODULE = path.resolve(path.join(__dirname, 'mock/basic_init_module.js'));

function wait(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

function random() {
    return Math.floor(Math.random() * 999999999999);
}


describe("Scheduler", function() {
    describe("Features", describeFeatures);
});

function describeFeatures() {
    var scheduler, pid, proc;

    beforeEach(function() {
        scheduler = new Scheduler();
        pid = null;
    });

    it("can spawn processes", function() {
        expect(function() {
            pid = scheduler.spawn(TEST_MODULE, true);
        }).to.not.throw(Error);
    });

    it("returns the pid of a spawned process", function() {
        pid = scheduler.spawn(TEST_MODULE, true);
        expect(pid).to.be.an.instanceOf(Process.Identifier);
    });

    it("can find a process from its pid", function() {
        pid = scheduler.spawn(TEST_MODULE, true);
        expect(function() {
            scheduler.__find(pid);
        }).to.not.throw(Error);
        expect(scheduler.__find(pid)).to.be.an.instanceOf(Process);
    });

    describe("Routing", describeRouting);
}

function describeRouting() {
    var scheduler, pidA, pidB;

    beforeEach(function() {
        scheduler = new Scheduler();
        pidA = scheduler.spawn(TEST_MODULE, true);
        pidB = scheduler.spawn(TEST_MODULE, true);
    });

    it("can route messages to a process with its pid", function() {
        var state = random(),
            proc = scheduler.__find(pidA);

        scheduler.send(pidA, {'op': 'set-value', 'name': 'state', 'value': state});
        return wait(10).then(function() {
            expect(proc.__context.state).to.be.equal(state);
        });
    });

    it("can route messages on behalf of processes", function() {
        var message = random(),
            procB = scheduler.__find(pidB);

        scheduler.send(pidA, {'op': 'send-set-value', 'target': pidB, 'name': 'state', 'value': message});
        return wait(10).then(function() {
            expect(procB.__context.state).to.be.equal(message);
        });
    });

    it("can route messages back to the sender", function() {
        var message = random(),
            procA = scheduler.__find(pidA);

        scheduler.send(pidA, {'op': 'send-set-value', 'target': pidA, 'name': 'state', 'value': message});
        return wait(10).then(function() {
            expect(procA.__context.state).to.be.equal(message);
        });
    });
}
