const serialize = require('./serialize');
const Immutable = require('immutable');

const LOCAL = 0;

const PIDRecord = Immutable.Record({node: LOCAL, proc: 0}, 'PID');
const Ref       = Immutable.Record({node: LOCAL, ref: 0}, 'Ref');

class PID extends PIDRecord {
    constructor(args) {
        super(args);
    }

    static of(node, proc) {
        return new PID({node, proc});
    }

    static fromJSON({node, proc}) {
        return PID.of(node, proc);
    }

    toJSON() {
        return serialize.wrapConstructor(PID, {node: this.get('node'), proc: this.get('proc')});
    }
}


// PID.of = (node, proc) => PID({node, proc});
Ref.of = (node, ref) => Ref({node, ref});

serialize.register(PID);
serialize.register(Ref);
serialize.register(Immutable.List);
serialize.register(Immutable.Map);

module.exports = {
    PID,
    Ref,
    LOCAL
};
