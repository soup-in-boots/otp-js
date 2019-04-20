const proc_lib = require('./proc_lib');

const ONE_FOR_ONE = Symbol.for('$otp:supervisor:one_for_one');
const ONE_FOR_ALL = Symbol.for('$otp:supervisor:one_for_all');

async function start(ctx, callbacks) {
    return proc_lib.start((ctx) => init(ctx, callbacks));
}

async function start_link() {
    return proc_lib.start_link((ctx) => init(ctx, callbacks));
}

async function init(ctx, callbacks) {
    const {ok, strategy, children} = callbacks.init(ctx);

    if (!ok)
        throw new Error('invalid initial state');

    const spawned = children.map(descriptor => {
        const pid = ctx.spawn_link(descriptor);
        return pid;
    });

    return loop(ctx, {children, spawned, strategy});
}

async function loop(ctx, state) {
    let running = true;
    while (running) {
        const message = ctx.receive();
    }
}

module.exports = {
    start,
    start_link,

    ONE_FOR_ONE,
    ONE_FOR_ALL,
};
