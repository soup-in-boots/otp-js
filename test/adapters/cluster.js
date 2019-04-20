const debug          = require('debug');
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const expect = chai.expect;

const serialize = require('../../lib/serialize');
const {create_node}            = require('../../lib/node');
const {create_cluster_manager} = require('../../lib/adapters/cluster');
const create_slave_adapter     = require('../../lib/adapters/cluster-slave');

const {create_mock_master_emitter, create_mock_slave_emitter} = require('./util');

const log = debug('open-telecom:test:adapters:cluster');

function mock_cluster() {
    const cluster = create_mock_master_emitter(mock_worker);

    function mock_worker(id) {
        const router        = make_mock_master_router(cluster);
        const emitter       = create_mock_slave_emitter(() => {});
        const slave_adapter = create_slave_adapter(emitter);
        const {OTPNode}     = create_node(slave_adapter);

        const node = new OTPNode(`test-${id}`);
        const worker = {
            send(message) {
                emitter.emit('message', message);
            },
            on(...args) {
                emitter.on(...args);
            },
            slave_adapter,
            emitter,
            node,
        };

        log('mock_worker : outbound_message');
        emitter.on('outbound_message', (message) => {
            log('outbound_message : %o', message);
            cluster.emit('message', worker, message);
        });

        return worker;
    }

    return cluster;
}

function make_mock_master_router(master) {
    return async function handle_message(worker, msg) {
        log('outbound_message : worker : %o', worker);
        master.emit('message', worker, msg);
    }
}

describe('cluster', async function() {
    let cluster = null;
    let Manager = null;
    let manager = null;

    beforeEach(function() {
        cluster = mock_cluster();
        Manager = create_cluster_manager(cluster);
        manager = new Manager();
        manager.start();
    });

    it('forks workers', function() {
        log('cluster : %o', cluster);
        expect(cluster.workers).to.be.an('array');
        expect(cluster.workers.length).to.be.above(0);
    });

    it('can deliver messages', async function() {
        let worker = manager.workers[0];
        let proc   = null;

        const messageReceived = new Promise((resolve, reject) => {
            proc = worker.node.spawn(async (ctx) => {
                let msg = await ctx.receive();
                resolve(msg);
            });
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        const payload = {to: proc, msg: Math.floor(Math.random() * Number.MAX_VALUE)};
        const externalized = worker.slave_adapter.externalize(worker.node, payload);

        worker.slave_adapter.deliver(externalized);
        expect(messageReceived).to.eventually.equal(payload.msg);
    });
});
