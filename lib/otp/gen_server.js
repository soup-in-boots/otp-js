const debug      = require('debug');
const getProcLib = require('./proc_lib');
const Immutable  = require('immutable');

const log = debug('open-telecom:otp:gen_server');

const CALL = '$otp:gen_server:call';
const CAST = '$otp:gen_server:cast';
const REPLY = '$otp:gen_server:reply';

module.exports = function getGenServer(node) {
    const proc_lib = getProcLib(node);

    async function start(ctx, callbacks) {
        const self      = ctx.self();
        const {ok, pid} = await proc_lib.start(ctx, async (ctx) => {
            await proc_lib.init_ack(ctx, self);

            const {ok, state} = await callbacks.init(ctx);

            if (ok) {
                return loop(ctx, callbacks, state);
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
        const ref  = node.makeRef();

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

    async function reply(ctx, from, response) {
        log('reply : %o', from);
        ctx.send(from.pid, {
            [REPLY]: response,
            from,
        });
    }

    async function loop(ctx, callbacks, state) {
        let ok = true;
        while (ok) {
            log('[%o] loop', ctx.self());
            const message = await ctx.receive();

            if (message[CALL]) {
                const result = await handleCall(ctx, callbacks, message, state);
                ok           = result.ok;
                state        = result.state;
            } else {
                log('WARNING : loop : unhandledMessage : %o', message);
            }
        }
    }

    async function handleCall(ctx, callbacks, message, state) {
        let result = await callbacks.handleCall(ctx, message[CALL], message.from, state);

        if (result.ok)
            state = result.state;

        if (result.reply)
            await reply(ctx, message.from, result.reply);

        return result;
    }

    return {start, call, reply};
}
