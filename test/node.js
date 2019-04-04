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
        expect(create_node).to.be.a.function;
    });

    it('creates a class', function() {
        const {OTPNode} = create_node();
        const inst      = new OTPNode();
        expect(OTPNode).to.be.a.function;
        expect(inst).to.be.an.object;
    });

    describe('OTPNode', describeOTPNode);
})

function describeOTPNode() {
    let node                = null;
    let proc                = null;
    let {OTPNode}           = create_node(null);

    beforeEach(function() {
        node = new OTPNode();
    });

    it('can create refs', function() {
        expect(node.ref).to.be.a.function;
        const ref = node.ref();
        expect(ref).to.be.an.instanceof(Ref);
    });

    it('can spawn message boxes', function() {
        proc = node.spawn(() => ({}));
        expect(proc).to.be.an.instanceof(PID);
    });

    it('can deliver messages', function(done) {
        proc = node.spawn(async (mb) => {
            log('spawned : %o', mb);
            const message = await mb.receive();
            expect(message).to.equal(1);
            log('spawned : received : %o', message);
            done();
        });
        expect(node.deliver).to.be.a.function;
        expect(node.deliver({to: proc, msg: 1})).to.not.throw;
    });
}

