initialized = true;

receive().then(handleMessage);
var running = true;
var context = global;

function main() {
    if (running) {
        return receive().then(handleMessage);
    }
}

function handleMessage(message) {
    switch(message.op) {
        case 'set-value':
            var name = message.name,
                value = message.value;

            context[name] = value;
            break;
        case 'send-set-value':
            var pid = message.target,
                name = message.name,
                value = message.value;

            send(pid, {'op':'set-value','name':name,'value':value});
            break;
        case 'die':
            running = false;
            break;
        case 'trap-exit':
            processFlag("trap_exit", true);
            break;
        case 'spawn':
            var res = spawn(message.handler).then(function(pid) {
                context.spawned = pid;
                main();
            });
            return res;
        default:
            break;
    }

    return main();
}
