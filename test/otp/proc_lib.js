const debug          = require('debug');
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const Immutable      = require('immutable');

chai.use(chaiAsPromised);

const expect = chai.expect;

const {create_node, Ref, PID} = require('../../lib/node');
const proc_lib     = require('../../lib/otp/proc_lib');

const log = debug('open-telecom:test:otp:proc_lib');

describe('proc_lib', function() {
    const {OTPNode} = create_node(null);

    let node                  = null;
    let ctx                   = null;
    let pid                   = null;

    beforeEach(function() {
        node    = new OTPNode();
        ctx      = node.make_context();
        pid      = ctx.self();
    });

    it('can start processes', async function() {
        expect(proc_lib).to.have.a.property('start');
        expect(proc_lib.start).to.be.a.function;

        log('start');
        const result = await proc_lib.start(ctx, async (ctx, spawner) => {
            log('init_ack');
            proc_lib.init_ack(ctx, spawner);
        });
        log('started : %o', result);

        expect(result).to.be.an.object;
        expect(result.ok).to.be.true;
        expect(result.pid).to.be.an.instanceof(PID);
    });

    it('can start and link processes', async function() {
        expect(proc_lib).to.have.a.property('start_link');
        expect(proc_lib.start_link).to.be.a.function;

        const {ok, pid} = await proc_lib.start_link(ctx, async (ctx, spawner) => {
            proc_lib.init_ack(ctx, spawner);
        });

        const exitMessage = await ctx.receive();
        expect(exitMessage).to.be.an.object;
        expect(exitMessage.exit).to.be.true;
        expect(exitMessage.pid).to.be.an.instanceof(PID);
        expect(Immutable.is(exitMessage.pid, pid)).to.be.true;
    })
})
