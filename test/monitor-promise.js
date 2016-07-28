const MonitorPromise = require('../lib/monitor-promise.js'),
      expect = require('chai').expect;

function resolveImmediately(ret, outerResolve) {
    return function(resolve) {
        resolve(ret);
        if (outerResolve) outerResolve();
    };
}

function resolveAfter(ms, ret, outerResolve) {
    return function(resolve) {
        setTimeout(function() {
            resolve(ret);
            if (outerResolve) outerResolve();
        }, ms);
    };
}

function rejectAfter(ms, reason, outerResolve) {
    return function(_resolve, reject) {
        setTimeout(function() {
            reject(reason);
            if (outerResolve) outerResolve();
        }, ms);
    };
}

describe("MonitoredPromise", function() {
    it("returns a constructor", function() {
        var promise = MonitorPromise(null, null);

        expect(promise).to.be.an.instanceOf(Function);
        expect(function() {
            new promise(resolveImmediately);
        }).to.not.throw(Error);
    });

    it("can be chained", function() {
        var promise = MonitorPromise(null, null),
            expected = {};
        return new promise(resolveImmediately(expected)).then(function(result) {
            expect(result).to.be.equal(expected);
        });
    });

    it("calls OnSchedule when instantiated", function() {
        var actual = null,
            expected = {};
        return new Promise(function(resolve) {
            var scheduled = function() {
                    actual = expected;
                    resolve();
                },
                promise = MonitorPromise(scheduled, null);

            expect(actual).to.not.be.equal(expected);
            return new promise(resolveImmediately(null));
            expect(actual).to.be.equal(expected);
        });
    });

    it("calls OnSchedule when a promise is chained", function() {
        var actual = null,
            expected = {};
        return new Promise(function(resolve) {
            var scheduled = function() {
                    actual = expected;
                    resolve();
                },
                promise = MonitorPromise(scheduled, null);

            expect(actual).to.not.be.equal(expected);
            new promise(resolveImmediately(null)).then(() => {});
            expect(actual).to.be.equal(expected);
        });
    });

    it("calls OnFinish when a promise is resolved", function() {
        var actual = null,
            expected = {};

        return new Promise(function(resolve) {
            var finished = function() {
                    actual = expected;
                    resolve();
                },
                promise = MonitorPromise(null, finished);

            expect(actual).to.not.be.equal(expected);
            var ret = new promise(resolveAfter(10, null));
            expect(actual).to.not.be.equal(expected);
            return ret
        }).then(function() {
            expect(actual).to.be.equal(expected);
        });
    });

    it("calls OnFinish when a chained promise is resolved", function() {
        var counter = 0;
        return new Promise(function(resolve) {
            var incr = function() { counter++; },
                decr = function() { counter--; },
                promise = MonitorPromise(incr, decr);

            expect(counter).to.be.equal(0);

            var init = new promise(resolveAfter(10, null));
            expect(counter).to.be.equal(1);

            var ret = init.then(function() {
                expect(counter).to.be.equal(1);
                resolve();
            });
            expect(counter).to.be.equal(2);
        }).then(function() {
            expect(counter).to.be.equal(0);
        });
    });

    it("calls OnFinish after being rejected", function() {
        var counter = 0;
        return new Promise(function(resolve) {
            var incr = function() { counter++; },
                decr = function() { counter--; },
                promise = MonitorPromise(incr, decr);

            expect(counter).to.be.equal(0);
            new promise(rejectAfter(10, null, resolve));
            expect(counter).to.be.equal(1);
        }).then(function() {
            expect(counter).to.be.equal(0);
        });
    });

    it("cannot be resolved or rejected multiple times", function() {
        var counter = 0;
        return new Promise(function(resolve) {
            var incr = function() { counter++; },
                decr = function() { counter--; },
                promise = MonitorPromise(incr, decr);

            var ret = new promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve();
                    resolve();
                    reject();
                    reject();
                }, 10);
            }).then(resolve, resolve);

            expect(counter).to.be.equal(2);

            return ret;
        }).then(function() {
            expect(counter).to.be.equal(0);
        });
    });
});
