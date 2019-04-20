const node_cluster = require('cluster');
const path    = require('path');
const os      = require('os');
const serialize = require('../serialize');
const debug        = require('debug');

const log = debug('open-telecom:adapters:cluster');

function create_cluster_manager(cluster = node_cluster) {
    class ClusterManager {
        constructor() {
            this.workers = [];
            this.node_ids = 0;
            this.cpus    = os.cpus();
        }

        start() {
            cluster.setupMaster({
                exec: path.resolve(__dirname, 'cluster-slave.js'),
            });

            for (let cpu of this.cpus) {
                const worker = cluster.fork();
                this.workers.push(worker);
            }

            cluster.on('message', (worker, message) => {
                log('message : %o', message);
                const parsed = serialize.parse(message);
                log('parsed : %o', parsed);
                this.handle_message(worker, parsed);
            });
        }

        async load_module(load_module) {
            for (let worker in this.workers) {
                await this.rpc(worker, 'load_module', [module]);
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

        deliver_message(message) {}

        rpc(worker, cmd, args = []) {
            return new Promise((resolve, reject) => {
                const ref = this.refs++;
                worker.send(serialize.stringify({cmd, args, ref}));
                this._resolvers.set(ref, {resolve, reject});
            });
        }
    }

    return ClusterManager;
}

module.exports = {create_cluster_manager};
