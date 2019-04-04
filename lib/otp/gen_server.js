const debug      = require('debug');
const proc_lib   = require('./proc_lib');
const Immutable  = require('immutable');

const log = debug('open-telecom:otp:gen_server');

const CALL  = Symbol.for('$otp:gen_server:call');
const CAST  = Symbol.for('$otp:gen_server:cast');
const REPLY = Symbol.for('$otp:gen_server:reply');

async function start(ctx, callbacks) {
    const self      = ctx.self();
    const {ok, pid} = await proc_lib.start(ctx, async (ctx) => {
        await proc_lib.init_ack(ctx, self);

        const {ok, state} = await callbacks.init(ctx);

        if (ok) {
            return enter_loop(ctx, callbacks, state);
        }
    });

    return {ok, pid};
}

async function start_link(ctx, callbacks) {
    const self      = ctx.self();
    const {ok, pid} = await proc_lib.start_link(ctx, async (ctx) => {
        await proc_lib.init_ack(ctx, self);

        const {ok, state} = await callbacks.init(ctx);

        if (ok) {
            return enter_loop(ctx, callbacks, state);
        }
    });

    return {ok, pid};
}

async function reply(ctx, from, message) {
    const {pid, ref} = from;
    ctx.send(pid, {[REPLY]: message, from});
}

async function call(ctx, pid, message, timeout = 5000) {
    const self = ctx.self();
    const ref  = ctx.ref();

    ctx.send(pid, {
        [CALL]: message,
        from: {pid: self, ref},
    });

    const response = await ctx.receive((message) => {
        const reply                 = message[REPLY];
        const {self, ref: replyRef} = message.from;
        if (message[REPLY] && Immutable.is(replyRef, ref))
            return true;
    }, timeout);

    return response[REPLY];
}

async function cast(ctx, pid, message) {
    ctx.send(pid, {[CAST]: message});
}

async function reply(ctx, from, response) {
    log('reply : %o', from);
    ctx.send(from.pid, {
        [REPLY]: response,
        from,
    });
}

async function enter_loop(ctx, callbacks, state) {
    let ok = true;
    while (ok) {
        log('[%o] enter_loop', ctx.self());
        const message = await ctx.receive();

        if (message[CALL]) {
            const result = await handleCall(ctx, callbacks, message, state);
            state        = result.state;
            ok           = result.ok;
        } else if (message[CAST]) {
            const result = await handleCast(ctx, callbacks, message, state);
            state        = result.state;
            ok           = result.ok;
        } else {
            const result = await handleInfo(ctx, callbacks, message, state);
            state        = result.state;
            ok           = result.ok;
        }
    }
}

async function handleCall(ctx, callbacks, message, state) {
    try {
        let result = await callbacks.handleCall(ctx, message[CALL], message.from, state);
        if (result.reply)
            await reply(ctx, message.from, result.reply);
        result.ok = true;
        return result;
    } catch (err) {
        const result = {};
        result.ok    = false;
        return result;
    }
}

async function handleCast(ctx, callbacks, message, state) {
    try {
        let result = await callbacks.handleCast(ctx, message[CAST], state);
        result.ok  = true;
        return result;
    } catch (err) {
        const result = {};
        result.ok    = false;
        return result;
    }
}

async function handleInfo(ctx, callbacks, message, state) {
    try {
        let result = await callbacks.handleInfo(ctx, message, state);
        result.ok  = true;
        return result;
    } catch (err) {
        const result = {};
        result.ok    = false;
        return result;
    }
}

module.exports = {
    call,
    cast,
    enter_loop,
    reply,
    start,
    start_link,
};
