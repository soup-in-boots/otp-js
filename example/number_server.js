const {createNode} = require('../lib');
const {OTPNode}    = createNode(null);
const node         = new OTPNode();

const gen_server = require('../lib/otp/gen_server');

async function start(ctx) {
    return gen_server.start(ctx, {init, handleCall, handleCast, handleInfo});
}

async function start_link(ctx) {
    return gen_server.start_link(ctx, {init, handleCall, handleCast, handleInfo});
}

function init(ctx) {
    const ok    = true;
    const state = 0;

    return {ok, state};
}

function handleCall(ctx, call, from, state) {
    switch (call) {
        case 'add':
            const newState = state + 1;
            return {reply: newState, state: newState};
        case 'subtract':
            const newState = state - 1;
            return {reply, state: state};
        default:
            return {state};
    }
}

function handleCast(ctx, cast, state) {
    switch (cast) {
        case 'add':
            const newState = state + 1;
            return {state: newState};
        case 'subtract':
            const newState = state - 1;
            return {state: state};
        default:
            return {state};
    }
}

function handleInfo(ctx, info, state) {
    if (typeof info == 'number')
        return {state: state * info};

    return {state};
}
