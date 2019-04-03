const debug        = require('debug');
const Immutable = require('immutable');
const {Context}    = require('./context');

const LOCAL = 0;

const log = debug('open-telecom:node');

const PID = Immutable.Record({node: LOCAL, proc: 0}, 'PID');
const Ref = Immutable.Record({node: LOCAL, ref: 0}, 'Ref');

PID.of = (node, proc) => PID({node, proc});
Ref.of = (node, ref) => Ref({node, ref});

function createNode(adapter) {
    class OTPNode {
        constructor() {
            this.contexts  = Immutable.Map();
            this._pids     = 0;
            this._refs     = 0;
        }

        ref() {
            return Ref.of(LOCAL, this._refs++);
        }

        make_ref() {
            return this.ref();
        }

        spawn(fun) {
            const ctx = this.make_context();
            (async () => {
                log('spawn : begin : %o', ctx.self());
                await fun(ctx);
                log('spawn : end : %o', ctx.self());
                ctx.destroy();
            })();

            return ctx.self();
        }

        spawn_link(linked, fun) {
            const ctx = this.make_context();
            ctx.link(linked);
            (async () => {
                log('spawn_link : begin : %o', ctx.self());
                await fun(ctx);
                log('spawn_link : end : %o', ctx.self());
                ctx.destroy();
            })();

            return ctx.self();
        }

        make_context() {
            const pid = PID.of(LOCAL, this._pids++);

            log('make_context');

            const ctx   = new Context(this, pid);
            this.contexts = this.contexts.set(pid, ctx);

            log('make_context : %o', ctx);

            return ctx;
        }

        deliver(message) {
            const {to} = message;

            log('deliver');

            if (to.node == LOCAL) {
                log('deliver : local : to : %o', to);
                log('deliver : local : contexts : %o', this.contexts);

                const ctx = this.contexts.get(to);

                log('deliver : local : ctx : %o', ctx);

                if (ctx)
                    ctx.deliver(message.msg);
            } else {
                adapter.deliver(n, message);
            }
        }

        send(to, msg) {
            log('send : to : %o', to);
            log('send : msg : %o', msg);
            this.deliver({to, msg});
        }

        destroy(pid) {
            log('destroy : %o', pid);
            this.contexts = this.contexts.delete(pid);
        }
    };

    return {OTPNode};
}

module.exports = {
    createNode,
    Ref,
    PID,
};
