const {Context}         = require('../lib/context.js');
const chai              = require('chai');
const chaiAsPromised    = require('chai-as-promised');

chai.use(chaiAsPromised);

const expect = chai.expect;

describe('Context', function() {
    describe('Features', describeFeatures);
});

function describeFeatures() {
    let ctx = null;
    let pid = null;

    beforeEach(function() {
        const node = 0;
        const proc = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        pid        = {node, proc};
        ctx        = new Context(null, pid);
    });

    it('knows its own pid', function() {
        expect(ctx.self).to.be.a.function;
        expect(ctx.self()).to.deep.equal(pid);
    });

    it('can be delivered messages', function() {
        expect(ctx.deliver).to.be.a.function;
        expect(ctx.deliver(1)).to.not.throw;
    });

    it('can receive messages', async function() {
        ctx.deliver(1);
        expect(ctx.receive).to.be.a.function;

        const received = await ctx.receive();

        expect(received).to.equal(1);
    });

    it('can time out receives', async function() {
        expect(ctx.receive).to.be.a.function;
        expect(ctx.receive(() => true, 1000)).to.be.rejected;
    });

    it('has a send function', function() {
        expect(ctx.send).to.be.a.function;
    });
}
