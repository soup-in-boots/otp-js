const {create_node} = require('../lib');
const debug         = require('debug');
const {OTPNode}     = create_node(null);
const node         = new OTPNode();

const gen_server = require('../lib/otp/gen_server');

const log = debug('open-telecom:example:number-server')

async function start(ctx) {
    return gen_server.start(ctx, {init, handle_call, handle_cast, handle_info});
}

async function start_link(ctx) {
    return gen_server.start_link(ctx, {init, handle_call, handle_cast, handle_info});
}

function init(ctx) {
    const ok    = true;
    const state = 0;

    log('init');

    return {ok, state};
}

function handle_call(ctx, call, from, state) {
    log('handle_call');
    switch (call) {
        case 'add': {
            const new_state = state + 1;
            return {reply: new_state, state: new_state};
        }
        case 'subtract': {
            const new_state = state - 1;
            return {reply, state: state};
        }
        case 'get': {
            return {reply: state, state};
        }
        default: {
            return {state};
        }
    }
}

function handle_cast(ctx, cast, state) {
    log('handle_cast');
    switch (cast) {
        case 'add': {
            const new_state = state + 1;
            return {state: new_state};
        }
        case 'subtract': {
            const new_state = state - 1;
            return {state: state};
        }
        default: {
            return {state};
        }
    }
}

function handle_info(ctx, info, state) {
    log('handle_info');
    if (typeof info == 'number')
        return {state: state * info};

    return {state};
}

module.exports = {
    start,
    start_link,
    handle_info,
    handle_call,
    handle_cast,
    init,
};
