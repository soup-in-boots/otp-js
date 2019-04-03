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
    }

    self() {
        return this.pid;
    }

    send(pid, message) {
        return this.node.send(pid, message);
    }

    destroy(reason) {
        this.node.destroy(this.pid);
        const pid  = this.pid;
        const exit = true;
        this.links.forEach(link => {
            this.send(link, {exit, pid, reason});
        });
    }

    async receive(predicate = any, timeout = false) {
        const index = this.messages.findIndex(predicate);

        if (index >= 0) {
            const [message] = this.messages.splice(index, 1);
            return message;
        }

        const message = await this._waitForMessage(predicate, timeout);
        return message;
    }

    deliver(message) {
        const index = this.receivers.findIndex(({predicate}) => predicate(message));

        if (index >= 0) {
            const [receiver] = this.receivers.splice(index, 1);
            receiver.resolve(message);
        } else {
            this.messages.push(message);
        }
    }

    _waitForMessage(predicate, timeout = false) {
        return new Promise((resolve, reject) => {
            const receiver = {predicate, resolve, reject};

            if (timeout) {
                receiver.timer = setTimeout(() => {
                    const index = this.receivers.indexOf(receiver);
                    this.receivers.splice(index, 1);
                    reject();
                }, timeout);
            }

            this.receivers.push(receiver);

            if (timeout) {
                clearTimeout(receiver.timer);
            }
        });
    }

    link(other) {
        this.links  = this.links.add(other.self());
        other.links = other.links.add(this.self());
    }
}

module.exports = {Context};
