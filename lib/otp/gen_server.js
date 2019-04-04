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

    log('call : %o', message);

    ctx.send(pid, {
        [CALL]: message,
        from: {pid: self, ref},
    });

    const response = await ctx.receive((message) => {
        const reply                 = message[REPLY];
        const {self, ref: reply_ref} = message.from;
        if (message[REPLY] && Immutable.is(reply_ref, ref))
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
    let result = null;
    while (ok) {
        log('[%o] enter_loop', ctx.self());
        const message = await ctx.receive();

        if (message[CALL]) {
            result       = await handle_call(ctx, callbacks, message, state);
            state        = result.state;
            ok           = result.ok;
        } else if (message[CAST]) {
            result       = await handle_cast(ctx, callbacks, message, state);
            state        = result.state;
            ok           = result.ok;
        } else {
            result       = await handle_info(ctx, callbacks, message, state);
            state        = result.state;
            ok           = result.ok;
        }

        if (!ok && result) {
            log('error : %o', result.error);
        }
    }
}

async function handle_call(ctx, callbacks, message, state) {
    try {
        let result = await callbacks.handle_call(ctx, message[CALL], message.from, state);
        if (result.reply)
            await reply(ctx, message.from, result.reply);
        result.ok = true;
        return result;
    } catch (error) {
        const result = {ok: false, error};
        return result;
    }
}

async function handle_cast(ctx, callbacks, message, state) {
    try {
        let result = await callbacks.handle_cast(ctx, message[CAST], state);
        result.ok  = true;
        return result;
    } catch (error) {
        const result = {ok: false, error};
        return result;
    }
}

async function handle_info(ctx, callbacks, message, state) {
    try {
        let result = await callbacks.handle_info(ctx, message, state);
        result.ok  = true;
        return result;
    } catch (error) {
        const result = {ok: false, error};
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
