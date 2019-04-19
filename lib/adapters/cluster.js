const node_cluster = require('cluster');
const path    = require('path');
const os      = require('os');
const serialize = require('../serialize');

function create_cluster_manager(cluster = node_cluster) {
    class ClusterManager {
        constructor() {
            this.workers = [];
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

            cluster.on('message',
                       (worker, message) => this.handle_message(worker, serialize.parse(message)));
        }

        async load_module(load_module) {
            for (let worker in this.workers) {
                await this.rpc(worker, 'load_module', [module]);
            }
        }

        handle_message(worker, message) {
            switch (message.cmd) {
                case 'deliver':
                    this.deliver_message(message.payload);
                    break;
                case 'rpc-reply':
                    this.handle_rpc_reply(message);
                    break;
                case 'rpc':
                    this.handle_rpc(message);
                    break;
            }
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
