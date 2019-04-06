const {Context}         = require('../lib/context.js');
const {PID}             = require('../lib/node');
const chai              = require('chai');
const chaiAsPromised    = require('chai-as-promised');

chai.use(chaiAsPromised);

const expect = chai.expect;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Context', function() {
    describe('Features', describeFeatures);
});

function describeFeatures() {
    let ctx = null;
    let pid = null;

    beforeEach(function() {
        const node = 0;
        const proc = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        pid        = PID.of(0, 0);
        ctx        = new Context(null, pid);
    });

    it('knows its own pid', function() {
        expect(ctx.self).to.be.a('function');
        expect(ctx.self()).to.deep.equal(pid);
    });

    it('can be delivered messages', function() {
        expect(ctx.deliver).to.be.a('function');
        expect(ctx.deliver(1)).to.not.throw;
    });

    it('can receive messages', async function() {
        expect(ctx.receive).to.be.a('function');

        ctx.deliver(1);
        const received = await ctx.receive();

        expect(received).to.equal(1);
    });

    it('can time out receives', async function() {
        expect(ctx.receive(() => true, 100)).to.eventually.be.rejected;
    });

    it('can wait indefinitely', async function() {
        expect(ctx.receive(() => true, false)).to.be.fulfilled;
        await wait(1000);
        ctx.deliver(1);
    });

    it('waits indefinitely by default', async function() {
        expect(ctx.receive(() => true)).to.be.fulfilled;
        await wait(1000);
        ctx.deliver(1);
    });

    it('has a send function', function() {
        expect(ctx.send).to.be.a('function');
    });
}
