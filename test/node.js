const debug        = require('debug');
const {create_node, Ref, PID} = require('../lib/node');
const expect       = require('chai').expect;
const Immutable    = require('immutable');

const log = debug('open-telecom:test:node');

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe('create_node', function() {
    it('is a function', function() {
        expect(create_node).to.be.a('function');
    });

    it('creates a class', function() {
        const {OTPNode} = create_node();
        const inst      = new OTPNode();
        expect(OTPNode).to.be.a('function');
        expect(inst).to.be.an('object');
    });

    describe('OTPNode', describeOTPNode);
})

const mock_adapter = {
    deliver(message) {
        return true;
    }
};

function describeOTPNode() {
    let node                = null;
    let proc                = null;
    let {OTPNode}           = create_node();

    beforeEach(function() {
        node = new OTPNode(mock_adapter);
    });

    it('can create refs', function() {
        expect(node.ref).to.be.a('function');
        expect(node.make_ref).to.be.a('function');

        const refA = node.ref();
        expect(refA).to.be.an.instanceof(Ref);

        const refB = node.make_ref();
        expect(refB).to.be.an.instanceof(Ref);
    });

    it('can spawn message boxes', function() {
        proc = node.spawn(() => ({}));
        expect(proc).to.be.an.instanceof(PID);
    });

    describe('deliver', function() {
        it('can deliver local messages', function(done) {
            proc = node.spawn(async (mb) => {
                log('spawned : %o', mb);
                const message = await mb.receive();
                expect(message).to.equal(1);
                log('spawned : received : %o', message);
                done();
            });
            expect(node.deliver).to.be.a('function');
            expect(node.deliver({to: proc, msg: 1})).to.not.throw;
        });

        it('accepts remote pids', async function() {
            proc = PID.of(1, 0);

            expect(node.deliver({to: proc, msg: 1})).to.not.throw;
        });

        it('tries to route remote messages', function() {
            proc = PID.of(1, 0);
            expect(node.deliver({to: proc, msg: 'test'}, true)).to.not.throw;
            expect(node.deliver({to: proc, msg: 'test'}, false)).to.not.throw;
        });
    });

    it('fails silently when a message is undeliverable', async function() {
        proc = node.spawn(async (mb) => {
                              // noop
                          });

        await wait(100);

        expect(node.deliver).to.be.a('function');
        expect(node.deliver({to: proc, msg: 1})).to.not.throw;
    });

    it('can register contexts under names', async function() {
        expect(node.register).to.be.a('function');
        const ctx = await node.make_context();
        expect(node.register(ctx, 'test')).to.not.throw;
    });

    it('can look up processes by their names', async function() {
        expect(node.whereis).to.be.a('function');

        const proc    = node.spawn(async (ctx) => {
            ctx.register('test');
            await ctx.receive();
        });
        const ctx     = node.make_context();

        expect(Immutable.is(await node.whereis('test'), proc)).to.be.true;
        expect(Immutable.is(await ctx.whereis('test'), proc)).to.be.true;
        expect(node.whereis('test_b')).to.be.undefined;
    });

    it('only allows one process to register a name', async function() {
        const result = await new Promise(async (resolve, reject) => {
            const procA = node.spawn(async (ctx) => {
                ctx.register('test');
                await ctx.receive();
            });

            const procB = node.spawn(async (ctx) => {
                resolve(ctx.register('test'));
            });
        });

        expect(result).to.be.false;
    });

    it('can route messages to a name', async function() {
        const message = Math.floor(Math.random() * Number.MAX_VALUE);
        const result  = await new Promise(async (resolve, reject) => {
            const pid = node.spawn(async ctx => {
                ctx.register('test');
                const result = await ctx.receive();
                resolve(result);
            });

            expect(node.send('test', message)).to.not.throw;
        });

        expect(result).to.equal(message);
    });

    it('unregisters contexts when they die', async function() {
        const proc = node.spawn(async (ctx) => {
            ctx.register('test');
            await ctx.receive();
        });

        await wait(10);

        expect(node.registered.has('test')).to.be.true;
        node.send(proc, 'stop');

        await wait(10);

        expect(node.registered.has('test')).to.be.false;
    });
}

