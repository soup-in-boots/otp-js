const cluster = require('cluster');
const path    = require('path');
const os      = require('os');

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
                   (worker, message, handler) => this.handle_message(worker, message, handle));
    }
}

module.exports = {ClusterManager};
