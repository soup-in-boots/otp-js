const hash = require('object-hash');
const debug = require('debug');

const registeredClasses = new Map(),
      registeredHashes = new Map(),
      constructorRX = /^\$serialize:constructor:(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
      symbolRX = /^\$serialize:symbol:(.*)$/;

const UNDEFINED = Symbol.for("$OTP_SERIALIZE_UNDEFINED");
const SERIALIZE_ASSIGN = Symbol.for('$OTP_SERIALIZE_ASSIGN');

const log = debug('otp:serialize');

function replaceStringify(key, value) {
    switch (typeof value) {
        case "symbol":
            return "$serialize:symbol:" + Symbol.keyFor(value);
        case "object":
            if (value === null) return value;
            if (value.constructor) return maybeReplaceObjectStringify(value);
            break;
    }

    return value;
}

function maybeReplaceObjectStringify(object) {
    var cons = object.constructor,
        proto = cons.prototype,
        key = null;

    do {
        if (registeredClasses.has(cons)) {
            key = registeredClasses.get(cons);
            break;
        }

        proto = Object.getPrototypeOf(cons.prototype);
        if (proto === null) break;
        cons = proto.constructor;
    } while(true);

    if (key == null) return object;

    return {[key]: Object.assign({}, object)};
}

function replaceParse(key, value) {
    switch (typeof value) {
        case "string":
            return maybeReplaceString(value);
        case "object":
            if (value == null) return null;
            return maybeReplaceObjectParse(value);
    }

    return value;
}

function maybeReplaceObjectParse(object) {
    var keys = Object.keys(object);

    if (keys.length == 1 && constructorRX.test(keys[0])) {
        var cons = registeredHashes.get(keys[0]);
        if (cons) {
            var json = object[keys[0]];
            if (cons.fromJSON) {
                json = cons.fromJSON(json);
            }

            if (!json.prototype || json.prototype.constructor !== cons) {
                result = Object.create(cons.prototype);
                Object.assign(result, json);
            } else {
                result = json;
            }

            return result;
        }
        throw new Error("Attempted to parse unregistered constructor: " + keys[0]);
    }

    return object;
}

function maybeReplaceString(string) {
    var m = null;
    if (m = string.match(symbolRX)) {
        return Symbol.for(m[1]);
    }
    return string;
}

function register(constructor) {
    if (registeredClasses.has(constructor)) return;

    var key = '$serialize:constructor:' + hash.sha1(constructor);
    if (registeredHashes.has(key)) {
        throw new Error("Hash collision on constructor source. Amazing.");
    }

    registeredClasses.set(constructor, key);
    registeredHashes.set(key, constructor);
}

function wrapConstructor(constructor, object) {
    if (registeredClasses.has(constructor)) {
        var key = registeredClasses.get(constructor);
        return {[key]: object};
    }

    throw new Error("Tried to wrap an object with the unregistered constructor: " + constructor.name);
}

function parse(string) {
    return JSON.parse(string, replaceParse);
}

function stringify(obj) {
    return JSON.stringify(obj, replaceStringify);
}

function reset() {
    registeredHashes.clear();
    registeredClasses.clear();
}

register(Error);
register(TypeError);

const Serialize = {
    stringify: stringify,
    parse: parse,
    register: register,
    reset: reset,
    wrap: wrapConstructor,
    wrapConstructor: wrapConstructor
};

Object.freeze(Serialize);
module.exports = Serialize;
