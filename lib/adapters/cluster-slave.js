const debug      = require('debug');
const cluster = require('cluster');
const {PID, Ref} = require('../types');
const serialize  = require('../serialize');

const log = debug('open-telecom:adapters:cluster-slave');

function create_adapter(emitter) {
    let rpc_count       = 0;
    const rpc_resolvers = new Map();
    const local_nodes   = new Map();

    emitter.on('message', (message) => {
        deliver(serialize.parse(message), false);
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
            emitter.send({ref, cmd, args});
        });

        return response;
    }

    async function find_node(node) {
        return rpc('find_node', [node]);
    }

    async function register_node(node) {
        const node_id = await rpc('register_node', []);
        return node_id;
    }

    async function discover() {
        const nodes = await rpc('discover');
        return nodes;
    }

    async function deliver(message, tryMaster = true) {
        log('deliver : %o', message);
        if (local_nodes.has(message.to.node)) {
            const node = local_nodes.get(message.to.node);
            node.deliver(localize(message.to.node, message));
            return;
        }

        if (tryMaster)
            rpc('deliver', serialize.stringify(message));
    }

    function localize(node_id, object) {
        if (typeof object === 'object') {
            if (object instanceof PID || object instanceof Ref) {
                if (object.node === node_id)
                    return pid.set('node', LOCAL);
                return object;
            }

            if (Array.isArray(object)) {
                return object.map((value) => localize(value));
            }

            for (let key in object) {
                object[key] = localize(object[key]);
            }

            return object;
        }

        return object;
    }

    async function system_process(ctx) {
        ctx.register(Symbol.for('otpjs:system'));

        while (true) {
            const msg = await ctx.receive();
            log('system_process : msg : %o', msg);
        }
    }

    return {register_node, deliver, system_process};
}

module.exports = create_adapter;
