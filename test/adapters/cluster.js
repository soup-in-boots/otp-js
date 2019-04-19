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

    const emitter       = create_mock_slave_emitter(make_mock_master_router(cluster));
    const slave_adapter = create_slave_adapter(emitter);
    const {OTPNode}     = create_node(slave_adapter);

    function mock_worker(id) {
        const node = new OTPNode(`test-${id}`);
        return node;
    }

    return cluster;
}

function make_mock_master_router(master) {
    const resolvers        = new Map();

    return async function handle_message(emitter, msg) {
        log('outbound_message : %O', msg);
        const worker = {
            send(message) {
                emitter.emit('message', message);
            }
        };
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
})
