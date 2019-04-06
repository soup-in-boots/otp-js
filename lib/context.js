const debug = require('debug');
const Immutable = require('immutable');

function any() {
    return true;
}

const log = debug('open-telecom:context');

class Context {
    constructor(node, pid) {
        this.pid       = pid;
        this.messages  = [];
        this.receivers = [];
        this.links     = Immutable.Set();
        this.status    = 'ALIVE';
        this.node      = node;
        this.death     = new Promise((resolve) => this.die = resolve);
    }

    self() {
        return this.pid;
    }

    ref() {
        return this.node.ref();
    }

    send(pid, message) {
        return this.node.send(pid, message);
    }

    spawn(fun) {
        return this.node.spawn(fun);
    }

    spawn_link(fun) {
        return this.node.spawn_link(this, fun);
    }

    register(name) {
        return this.node.register(this, name);
    }

    whereis(name) {
        return this.node.whereis(name);
    }

    destroy(reason) {
        this.node.destroy(this.pid);
        const pid  = this.pid;
        const exit = true;
        this.links.forEach(link => {
            this.send(link, {exit, pid, reason});
        });
        this.die();
    }

    async receive(predicate = any, timeout = false) {
        const index = this.messages.findIndex(predicate);

        if (index >= 0) {
            const [message] = this.messages.splice(index, 1);
            return message;
        }

        const message = await this._wait_for_message(predicate, timeout);
        return message;
    }

    deliver(message) {
        const index = this.receivers.findIndex(({predicate}) => predicate(message));

        if (index >= 0) {
            const [receiver] = this.receivers.splice(index, 1);
            receiver.resolve(message);
            if (receiver.timer) {
                clearTimeout(receiver.timer);
            }
        } else {
            this.messages.push(message);
        }
    }

    _wait_for_message(predicate, timeout) {
        return new Promise((resolve, reject) => {
            const receiver = {predicate, resolve, reject};

            if (timeout !== false) {
                receiver.timer = setTimeout(() => {
                    const index = this.receivers.indexOf(receiver);
                    this.receivers.splice(index, 1);
                    reject();
                }, timeout);
            }

            this.receivers.push(receiver);
        });
    }

    link(other) {
        this.links  = this.links.add(other.self());
        other.links = other.links.add(this.self());
    }
}

module.exports = {Context};
