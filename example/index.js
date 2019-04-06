const debug         = require('debug');
const {create_node} = require('../lib/node');
const number_server = require('./number_server');
const gen_server    = require('../lib/otp/gen_server');

const {OTPNode} = create_node();

const node = new OTPNode();

const log = debug('open-telecom:example');

node.spawn(async function(ctx) {
    const result    = await number_server.start_link(ctx);
    const {ok, pid} = result;

    log('result : %o', result);

    await gen_server.call(ctx, pid, 'add');
    gen_server.cast(ctx, pid, 'add');
    ctx.send(pid, 3);
    ctx.send(pid, 7);

    const final = await gen_server.call(ctx, pid, 'get');
    log('final : %o', final);
});
