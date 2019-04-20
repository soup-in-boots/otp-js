const proc_lib = require('./proc_lib');

async function start(ctx, callbacks) {
    return proc_lib.start((ctx) => init(ctx, callbacks));
}

async function start_link() {
    return proc_lib.start_link((ctx) => init(ctx, callbacks));
}

async function init(ctx) {}

async function loop(state) {}

module.exports = {
    start,
    start_link
};
