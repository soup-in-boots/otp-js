const debug          = require('debug');
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const {EventEmitter} = require('events');

chai.use(chaiAsPromised);

const expect = chai.expect;

const serialize       = require('../../lib/serialize');
const {create_node}   = require('../../lib/node');
const create_adapter  = require('../../lib/adapters/cluster-slave');
const {PID}           = require('../../lib/types');

const log = debug('open-telecom:test:adapters:cluster');

function create_emitter() {
    const emitter = new EventEmitter();
    emitter.send = (message) => emitter.emit('outbound_message', message);

    let node_ids = 0;

    emitter.on('outbound_message', (msg) => {
        let result = null;
        let error  = null;

        log('outbound_message : %O', msg);

        switch (msg.cmd) {
            case 'register_node':
                result = ++node_ids;
                break;
            case 'deliver':
                emitter.emit('deliver', msg.args);
                break;
            default:
                error = new Error('Unknown command');
                break;
        }

        emitter.emit('rpc-reply', {result, error, ref: msg.ref});
    });

    return emitter;
}

describe('cluster_adapter', function() {
    const to      = PID.of(0, 0);
    const payload = Math.floor(Math.random() * Number.MAX_VALUE);
    const message = {to, payload};

    const emitter         = create_emitter();
    const cluster_adapter = create_adapter(emitter);
    const {OTPNode}       = create_node(cluster_adapter);
    let node              = null;

    beforeEach(() => {
        node = new OTPNode('test');
    });


    it('provides a system process', async () => {
        expect(cluster_adapter).to.have.a.property('system_process');
        expect(cluster_adapter.system_process).to.be.a('function');
    });

    it('registers nodes', async () => {
        let registration = null;
        expect(cluster_adapter.register_node).to.be.a('function');
        expect(registration = await cluster_adapter.register_node()).to.not.throw;
        expect(registration).to.be.a('number');
    });

    it('delivers messages', () => {
        expect(cluster_adapter.deliver).to.be.a('function');
        return new Promise((resolve, reject) => {
            emitter.once('deliver', resolve);
            expect(cluster_adapter.deliver(message)).to.not.throw;
        })
    });
});
