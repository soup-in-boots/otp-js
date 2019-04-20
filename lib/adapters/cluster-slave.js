const debug      = require('debug');
const cluster = require('cluster');
const {PID, Ref} = require('../types');
const serialize  = require('../serialize');
const {LOCAL}    = require('../types');

const log = debug('open-telecom:adapters:cluster-slave');

function create_adapter(emitter) {
    let rpc_count       = 0;
    const rpc_resolvers = new Map();
    const local_nodes   = new Map();
    const local_node_ids = new Map();

    emitter.on('message', (message) => {
        log('message : %o', message);
        const parsed = serialize.parse(message);
        log('parsed : %o', parsed);
        handle_message(parsed, false);
    });

    emitter.on('rpc-reply', (reply) => {
        log('rpc-reply : %o', reply);
        const {resolve, reject} = rpc_resolvers.get(reply.ref);

        rpc_resolvers.delete(reply.ref);

        if (reply.error) {
            return reject(reply.error);
        }

        return resolve(reply.result);
    });

    async function rpc(cmd, args) {
        const ref = rpc_count++;

        const response = await new Promise((resolve, reject) => {
            rpc_resolvers.set(ref, {resolve, reject});
            emitter.send(serialize.stringify({ref, cmd, args}));
        });

        return response;
    }

    async function find_node(node) {
        return rpc('find_node', [node]);
    }

    async function register_node(node) {
        const node_id = await rpc('register_node', []);
        local_nodes.set(node_id, node);
        local_node_ids.set(node, node_id);
        return node_id;
    }

    async function discover() {
        const nodes = await rpc('discover');
        return nodes;
    }

    async function handle_message(message) {
        switch (message.cmd) {
            case 'rpc-reply':
                return handle_rpc_reply(message);
            case 'deliver':
                return deliver(message.payload, false);
        }
    }

    async function handle_rpc_reply(reply) {
        const {resolve, reject} = rpc_resolvers.get(reply.ref);

        rpc_resolvers.delete(reply.ref);

        if (reply.error) {
            return reject(reply.error);
        }

        return resolve(reply.result);
    }

    async function deliver(message, tryMaster = true) {
        log('deliver : %O', message);

        if (local_nodes.has(message.to.node)) {
            const node = local_nodes.get(message.to.node);
            node.deliver(localize(message.to.node, message), false);
            return;
        }

        if (tryMaster)
            rpc('deliver', [message]);
    }

    function localize(node_id, object) {
        log('localize : %o', node_id);
        log('localize : %o', object);

        if (typeof object === 'object') {
            log('localize : object');
            if (object instanceof PID || object instanceof Ref) {
                log('localize : object instanceof PID or REF');
                if (object.node === node_id) {
                    log('localize : %o === %o', object.node, node_id);
                    return object.set('node', LOCAL);
                }
                return object;
            }

            if (Array.isArray(object)) {
                log('localize : array');
                object = object.map((value) => localize(node_id, value));
                return object;
            }

            for (let key in object) {
                log('localize : object keys');
                object[key] = localize(node_id, object[key]);
            }
        }

        return object;
    }

    function externalize(node, object) {
        const node_id = local_node_ids.get(node);

        log('externalize : %o', node);
        log('externalize : %o', node_id);

        if (typeof object === 'object') {
            if (object instanceof PID || object instanceof Ref) {
                if (object.node === LOCAL)
                    return object.set('node', node_id);
                return object;
            }

            if (Array.isArray(object)) {
                object = object.map((value) => externalize(node, value));
            }

            for (let key in object) {
                object[key] = externalize(node, object[key]);
            }
        }

        return object;
    }

    async function system_process(ctx) {
        ctx.register('system');

        while (true) {
            const msg = await ctx.receive();
            log('system_process : msg : %o', msg);

            if (msg === 'stop')
                break;
        }
    }

    return {register_node, deliver, discover, system_process, localize, externalize};
}

module.exports = create_adapter;
