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

const {create_mock_slave_emitter} = require('./util');

const log = debug('open-telecom:test:adapters:cluster');

describe('cluster_adapter', function() {
    const emitter         = create_mock_slave_emitter();
    const cluster_adapter = create_adapter(emitter);
    const {OTPNode}       = create_node(cluster_adapter);
    let node_a            = null;
    let node_b            = null;
    let proc              = null;

    beforeEach(() => {
        node_a = new OTPNode('test_a');
        node_b = new OTPNode('test_b');
    });

    it('provides a system process', async () => {
        expect(cluster_adapter).to.have.a.property('system_process');
        expect(cluster_adapter.system_process).to.be.a('function');
        proc = await node_a.spawn(cluster_adapter.system_process);
        expect(proc).to.be.an.instanceof(PID);
    });

    it('registers nodes', async () => {
        let registration = null;
        expect(cluster_adapter.register_node).to.be.a('function');
        expect(cluster_adapter.register_node()).to.eventually.be.a('number');
    });

    it('delivers messages', () => {
        expect(cluster_adapter.deliver).to.be.a('function');
        log('delivers messages : node_a : %o', node_a);
        return new Promise((resolve, reject) => {
            emitter.once('deliver', resolve);

            expect(function() {
                const to      = node_a.spawn(cluster_adapter.system_process);
                const payload = cluster_adapter.externalize(node_a, {
                    description: {
                        value: {type: 'integer'},
                        self: {type: 'pid'},
                    },
                    value: Math.floor(Math.random() * Number.MAX_VALUE),
                    self: to,
                });
                const message = {to, payload};
                cluster_adapter.deliver(message, true)
            }).to.not.throw();
        });
    });

    it('knows about local nodes', async () => {
        expect(cluster_adapter).to.have.a.property('discover');
        expect(cluster_adapter.discover).to.be.a('function');
        expect(cluster_adapter.discover()).to.not.be.rejected;
        expect(cluster_adapter.discover()).to.eventually.be.an('array');
    });
});
