const {EventEmitter} = require('events');
const debug          = require('debug');
const serialize      = require('../../lib/serialize');

const log = debug('open-telecom:test:adapters:util');

function outbound_message_handler() {
    let node_ids = 0;

    return function(emitter, msg) {
        let result = null;
        let error  = null;

        msg = serialize.parse(msg);
        log('outbound_message : %O', msg);

        switch (msg.cmd) {
            case 'register_node':
                result = ++node_ids;
                break;
            case 'deliver':
                emitter.emit('deliver', msg.args);
                break;
            case 'discover':
                emitter.emit('discover', msg.args);
                result = [];
                break;
            default:
                error = new Error(`Unknown command: ${msg.cmd}`);
                break;
        }

        emitter.emit('rpc-reply', {result, error, ref: msg.ref});
    }
}

function create_mock_slave_emitter(message_handler = outbound_message_handler()) {
    const emitter = new EventEmitter();

    emitter.send = (message) => emitter.emit('outbound_message', message);
    emitter.on('outbound_message', (...args) => message_handler(emitter, ...args));

    return emitter;
}

function create_mock_master_emitter(mock_worker) {
    const emitter = new EventEmitter();

    emitter.workers     = [];
    emitter.setupMaster = function() {};
    emitter.fork        = function() {
        const worker = mock_worker(emitter.workers.length);
        emitter.workers.push(worker);
        return worker;
    };

    return emitter;
}

module.exports = {
    create_mock_slave_emitter,
    create_mock_master_emitter,
};
