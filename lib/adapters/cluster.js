const node_cluster = require('cluster');
const path    = require('path');
const os      = require('os');
const serialize = require('../serialize');
const debug        = require('debug');
const {PID}        = require('../types');

const log = debug('open-telecom:adapters:cluster');

function create_cluster_manager(cluster = node_cluster) {
    class ClusterManager {
        constructor() {
            this.workers = [];
            this.node_ids = 0;
            this.cpus    = os.cpus();
            this.resolvers    = new Map();
            this.node_workers = new Map();
        }

        async start() {
            cluster.setupMaster({
                exec: path.resolve(__dirname, 'slave-start.js'),
            });

            cluster.on('message', (worker, message) => {
                log('message : %o', message);
                const parsed = serialize.parse(message);
                log('parsed : %o', parsed);
                this.handle_message(worker, parsed);
            });

            for (let cpu of this.cpus) {
                log('fork');
                const worker = cluster.fork();
                this.workers.push(worker);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        async load_module(module) {
            log('load_module : %o', module);
            for (let node_id of this.node_workers.keys()) {
                log('load_module : deliver : %o', node_id);
                await this.deliver_message(
                    {to: PID.of(node_id, 0), msg: {cmd: 'load_module', args: [module]}});
            }
        }

        async handle_message(worker, message) {
            let result = null;
            let error  = null;

            switch (message.cmd) {
                case 'deliver':
                    await this.deliver_message(message.payload);
                    result = true;
                    break;
                case 'register_node':
                    const node_id = ++this.node_ids;
                    this.node_workers.set(node_id, worker);
                    result        = node_id;
                    break;
                default:
                    error = new Error(`Unknown Command: ${message.cmd}`);
                    console.error(`UNKNOWN MESSAGE: %o`, message);
            }

            log('handle_message : command : %o', message.cmd);
            log('handle_message : result : %o', result);

            worker.send(serialize.stringify({cmd: 'rpc-reply', ref: message.ref, error, result}));
        }

        deliver_message(message) {
            log('deliver_message : %o', message);

            const node_id = message.to.node;
            const worker  = this.node_workers.get(node_id);

            worker.send(serialize.stringify({cmd: 'deliver', payload: message}))
        }
    }

    return ClusterManager;
}

module.exports = {create_cluster_manager};
