const debug          = require('debug');
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const Immutable      = require('immutable');

chai.use(chaiAsPromised);

const expect = chai.expect;

const {createNode, Ref, PID} = require('../../lib/node');
const gen_server   = require('../../lib/otp/gen_server');

const log = debug('open-telecom:test:otp:gen_server');

describe('gen_server', function() {
    const {OTPNode} = createNode(null);

    let node       = null;
    let ctx        = null;
    let pid        = null;

    function init(ctx) {
        const ok    = true;
        const state = {};

        log('init : state : %o', state);

        return {ok, state};
    }

    function handleCall(ctx, command, from, state) {
        const ok = true;

        log('handleCall : command : %o', command);

        switch (command.msg) {
            case 'set':
                return {ok, reply: ok, state: command.value};
            case 'get':
                return {ok, reply: state, state};
            default:
                return {ok, state};
        }
    }

    const callbacks = {init, handleCall};

    beforeEach(function() {
        node       = new OTPNode();
        ctx        = node.make_context();
    })

    it('starts a process', async function() {
        expect(gen_server.start).to.be.a.function;

        const {ok, pid} = await gen_server.start(ctx, callbacks);
        expect(ok).to.be.true;
        expect(pid).to.be.an.instanceof(PID);
    });

    it('can be called', async function() {
        expect(gen_server.call).to.be.a.function;

        const {ok, pid} = await gen_server.start(ctx, callbacks);
        const value     = Math.floor(Math.random() * Number.MAX_VALUE);
        const resultA   = await gen_server.call(ctx, pid, {
            msg: 'set',
            value,
        });

        const resultB = await gen_server.call(ctx, pid, {msg: 'get'});

        expect(resultA).to.be.true;
        expect(resultB).to.equal(value);
    });
});

