"use strict";
const MonitorPromise = require('./monitor-promise'),
      Serialize = require('./serialize.js'),
      fs = require('fs'),
      vm = require('vm');


/**
 * @readonly
 * @enum {Symbol}
 */
const ProcessStates = {
    /** The DEAD state indicates the process is no longer running. */
    DEAD:       Symbol.for("$OTP_DEAD"),
    /** The RUNNING state indicates the process is in the middle of processing a message */
    RUNNING:    Symbol.for("$OTP_RUNNING"),
    /** The WAITING state indicates the process is waiting for a message to start {RUNNING} */
    WAITING:    Symbol.for("$OTP_WAITING")
};

/**
 * @readonly
 * @enum {Symbol}
 */
const ProcessSignals = {
    /** The KILL signal is an untrappable exit signal. */
    KILL:       Symbol.for("$OTP_KILL"),
    /** The EXIT signal is used to denote an exit message. */
    EXIT:       Symbol.for("$OTP_EXIT")
}

/**
 * @readonly
 * @enum {string}
 */
const ProcessFlags = new Set([
        /** Capture exit signals (except KILL) */
        'trap_exit'
]);

const Modules = {};
function LoadModule(module) {
    if (Modules[module]) return Modules[module];
    return Modules[module] = new vm.Script(fs.readFileSync(module, 'utf8'), {
        filename: module,
        displayErrors: true
    });
}

class ProcessIdentifier {
    constructor(schedulerID, procID) {
        this.__schedulerID = schedulerID;
        this.__procID = procID;
    }

    get schedulerID() { return this.__schedulerID; }
    get procID() { return this.__procID; }

    toJSON() {
        return Serialize.wrap(ProcessIdentifier, {
            scid: this.__schedulerID,
            prid: this.__procID
        });
    }

    static fromJSON(json) {
        return new ProcessIdentifier(json.scid, json.prid);
    }
}

Serialize.register(ProcessIdentifier);

/**
 * @define SYSTEM
 * @private
 * @type {Symbol}
 * @description
 *
 * A hidden symbol we can use when we want to use the messaging
 * system for our own purposes without disrupting the normal
 * operation of modules.
 */
const SYSTEM    = Symbol.for("$OTP_SYSTEM");

/**
 * Process
 */
class Process {
    /* STATIC METHODS AND ACCESSORS */
    /**
     * State indicating the process has stopped executing
     * @type {DEAD}
     */

    static get DEAD() { return ProcessStates.DEAD; }
    /**
     * State indicating the process is currently processing a message
     * @type {RUNNING}
     */

    static get RUNNING() { return ProcessStates.RUNNING; }
    /**
     * State indicating the process is currently waiting for a message
     * @type {WAITING}
     */
    static get WAITING() { return ProcessStates.WAITING; }

    /**
     * Symbol for the EXIT signal
     * @type {EXIT}
     */
    static get EXIT() { return ProcessSignals.EXIT; }

    /**
     * Symbol for the KILL signal
     * @type {KILL}
     */
    static get KILL() { return ProcessSignals.KILL; }

    static get SYSTEM() { return SYSTEM; }

    static get Identifier() { return ProcessIdentifier; }

    /**
     * exit
     *
     * @static
     * @param proc {Process}
     * @param reason {*}
     * @returns {undefined}
     */
    static exit(proc, reason) {
        proc.__give({
            'system': SYSTEM,
            'op': ProcessSignals.EXIT,
            'reason': reason
        });
    }

    /**
     * @define __makeContext
     *
     * Prepare a new {Process} context for the provided proc.
     *
     * @private
     * @static
     * @param proc {Process} - Process object to bind this context too
     * @returns {undefined}
     */
    static __makeContext(proc) {
        var context = vm.createContext(),
            procsy = new Proxy(proc, {}),
            promise = MonitorPromise(proc.__scheduleContinuation, proc.__finishContinuation);
        context.require = function(module) {
            var resolved = require.resolve(module),
                module = LoadModule(resolved),
                sandbox = {
                    Promise: promise,
                    module: {
                        exports: {}
                    }
                };
            return module.runInNewContext(sandbox).module.exports;
        };
        context.global = context;
        context.Promise = promise;
        context.console = console;
        context.receive = procsy.receive.bind(procsy);
        context.processFlag = function() {
            proc.__setFlag(...arguments);
        };
        context.send = function() {
            proc.__scheduler.send(...arguments);
        };
        context.self = function() {
            return proc.__pid;
        };
        context.spawn = function() {
            return new promise((resolve) => {
                return proc.__scheduler.spawn(...arguments).then(function() {
                    resolve(...arguments);
                });
            });
        };
        return context;
    }

    /**
     * Processes are discrete continuation-based execution contexts. They are not
     * allowed to access the global scope, but are instead allowed to send messages
     * to one another via their process IDs.
     *
     * @param pid {ProcessIdentifer} - The pid of the new process
     * @param moduleName {string} - The path to the node module you want to run as a process
     * @param scheduler {Scheduler} - The scheduler that spawned the process
     * @returns {undefined}
     */
    constructor(pid, modulePath, scheduler) {
        this.__pid          = pid;
        this.__messageBox   = [];
        this.__context      = Process.__makeContext(this);
        this.__pendingContinuation = 0;
        this.__flags        = {};
        this.__scheduler    = scheduler;

        var path    = require.resolve(modulePath),
            module  = LoadModule(path);

        this.__scheduleContinuation();
        this.__state = ProcessStates.RUNNING;
        module.runInContext(this.__context)
        this.__finishContinuation();
        this.__checkFinish();
    }

    /**
     * receive
     *
     * @returns {Promise}
     */
    receive() {
        if (this.__state == ProcessStates.DEAD)
            throw new Error("Trying to receive for a dead process");

        this.__state = ProcessStates.WAITING;

        if (this.__messageBox.length > 0) {
            return new this.__context.Promise((resolve, reject) => {
                var message = this.__messageBox.shift();
                this.__resolve = resolve;
                this.__reject = reject;
                this.__handleMessage(message);
            });
        }

        return new this.__context.Promise((resolve, reject) => {
            this.__resolve = resolve;
            this.__reject = reject;
        });
    }

    /**
     * @define __scheduleContinuation
     *
     * Mark a continuation as pending.
     *
     * @private
     * @returns {Function}
     */
    get __scheduleContinuation() {
        return () => {
            this.__pendingContinuation++;
        }
    }

    /**
     * @define __finishContinuation
     *
     * Mark a continuation as finished and check to see if we have
     * anything left to do.
     *
     * @private
     * @returns {Function}
     */
    get __finishContinuation() {
        return () => {
            this.__pendingContinuation--;
            this.__checkFinish();
        }
    }

    /**
     * @define __handleMessage
     *
     * Intercept system messages if necessary, otherwise pass on
     * to the receiving continuation.
     *
     * @private
     * @param message
     * @returns {undefined}
     */
    __handleMessage(message) {
        if (message.system == SYSTEM) {
            return this.__handleSystemMessage(message);
        }

        this.__state = ProcessStates.RUNNING;
        this.__resolve(message);
    }

    /**
     * @define __handleSystemMessage
     *
     * Handler for system messages, like exit signals from linked
     * processes
     *
     * @private
     * @param message
     * @returns {undefined}
     */
    __handleSystemMessage(message) {
        if (message.op == ProcessSignals.EXIT) {
            if (message.reason == ProcessSignals.KILL || !this.__flags['trap_exit']) {
                this.__pendingContinuation = 0;
                return this.__checkFinish();
            }

            delete message.system;
            return this.__handleMessage(message);
        }
    }

    /**
     * @define __setFlag
     *
     * @private
     * @param flag {ProcessFlag} - The flag to set
     * @param value
     * @returns {undefined}
     */
    __setFlag(flag, value) {
        if (!ProcessFlags.has(flag)) return;
        this.__flags[flag] = value;
    }

    /**
     * @define __checkFinish
     *
     * Checks to see if the process is finished, and if so
     * sets its state appropriately and clears its context
     *
     * @private
     * @returns {undefined}
     */
    __checkFinish() {
        // If we have outstanding continuations, we're not done
        if (this.__pendingContinuation > 0) return;

        // If we have no outstanding continuations, we're done and should
        // stop ourselves from doing anything else.
        this.__context = null;
        this.__state = ProcessStates.DEAD;
    }

    /**
     * @define __give
     *
     * Internal method that provides a process with a message. If the
     * process is waiting, invokes __handleMessage; otherwise stashes
     * it for later.
     *
     * @private
     * @param message
     * @returns {undefined}
     */
    __give(message) {
        if (this.__state == ProcessStates.WAITING) {
            return this.__handleMessage(message);
        }

        this.__messageBox.push(message);
    }
}

module.exports = Process;
