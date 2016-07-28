var Process = require("../lib/process.js");
var expect = require('chai').expect;

function wait(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

function random() {
    return Math.floor(Math.random() * 999999999999);
}

describe("Process", function() {
    var proc, state;

    beforeEach(function() {
        proc = new Process(null, __dirname + '/mock/basic_init_module');
    });

    it("runs a module", function() {
        expect(proc.__state).to.be.equal(Process.WAITING);
        expect(proc.__context.initialized).to.be.true;
    });

    it("has a pid", function() {
        expect(proc.__pid).to.not.be.undefined;
    });

    it("can receive messages", function() {
        expect(function() {
            proc.__give({});
        }).to.not.throw(Error);
    });

    it("can consume messages", function() {
        expect(proc.receive.bind(proc)).to.not.throw(Error);
    });

    it("can do things with messages it consumes", function() {
        proc.__give({'op': 'set-value', 'name': 'state', 'value': 5});
        return wait(10).then(function() {
            expect(proc.__context.state).to.be.equal(5);
        });
    });

    it("queues messages up", function() {
        var state = random();
        proc.__give({'op':'wait','ms':10});
        proc.__give({'op':'set-value', 'name': 'state', 'value': state});
        expect(proc.__context.state).to.not.be.equal(state);
        return wait(20).then(function() {
            expect(proc.__context.state).to.be.equal(state);
        });
    });

    it("dies when it has nothing to do", function() {
        proc.__give({'op':'die'});
        return wait(10).then(function() {
            expect(proc.__context).to.be.equal(null);
            expect(proc.__state).to.be.equal(Process.DEAD);
        });
    });

    it("can be killed", function() {
        Process.exit(proc, "normal");
        return wait(10).then(function() {
            expect(proc.__context).to.be.equal(null);
            expect(proc.__state).to.be.equal(Process.DEAD);
        });
    });

    it("can trap most exits if it wants", function() {
        proc.__give({'op':'trap-exit'});
        Process.exit(proc, 'normal');

        return wait(10).then(function() {
            expect(proc.__state).to.not.be.equal(Process.DEAD);
            expect(proc.__flags['trap_exit']).to.be.true;
        });
    });

    it("cannot trap KILL signals", function() {
        Process.exit(proc, Process.KILL);
        return wait(10).then(function() {
            expect(proc.__state).to.be.equal(Process.DEAD);
        });
    });
});
