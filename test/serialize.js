const Serialize = require('../lib/serialize.js'), assert = require('chai').assert,
      expect = require('chai').expect, vm = require('vm');

class TestClass {
    constructor(value) {
        this.test = value;
        this.bar = function() {
            return false;
        }
    }

    foo() {
        return this.bar();
    }
};

class TestClassA extends TestClass {
    constructor(value) {
        super(value);
    }

    baz() {
        return this.test;
    }
}

class TestClassB {
    constructor(value) {
        this.test = value;
        this.bar = function() {
            return "" + value;
        }
    }

    toJSON() {
        return Serialize.wrap(TestClassB, {
            test: this.test,
            baz: "foo"
        });
    }

    static fromJSON(json) {
        json.fromJSONd = true;
        delete json.baz;
        return json;
    }
}

function random() {
    return Math.floor(Math.random() * 999999999999);
}

process.on('uncaughtException', function(e) {
    console.log(e.stack);
});

describe('Serialize', function() {
    beforeEach(() => {
        Serialize.reset();
    });

    it("implements stringify", function() {
        expect(Serialize.stringify).to.be.an.instanceOf(Function);
        expect(Serialize.stringify({})).to.be.equal("{}");
    });

    it("implements parse", function() {
        expect(Serialize.parse).to.be.an.instanceOf(Function);
        expect(Serialize.parse("{}")).to.be.an.instanceOf(Object);
    });

    it('replaces symbols', function() {
        var sym = Symbol.for("$SERIALIZE_TEST_SYMBOL");
        expect(Serialize.stringify(sym)).to.be.equal("\"$serialize:symbol:$SERIALIZE_TEST_SYMBOL\"");
        expect(Serialize.parse("\"$serialize:symbol:$SERIALIZE_TEST_SYMBOL\"")).to.be.equal(sym);
    });

    it('leaves plain objects alone', function() {
        let result = null;
        expect(function() {
            result = Serialize.stringify({a: {b: 2}});
        }).to.not.throw();

        expect(result).to.be.a('string');
        expect(result).to.equal('{"a":{"b":2}}');
    });

    it('can be extended for replacing objects', function() {
        expect(Serialize.register(TestClass)).to.not.throw;
    });

    it('can only register a class once', function() {
        expect(Serialize.register(TestClass)).to.not.throw;
        expect(Serialize.register(TestClass)).to.throw;
    });

    it("can serialize user-defined objects", function() {
        Serialize.register(TestClass);
        var inst = new TestClass(),
            serialized;

        expect(function() {
            serialized = Serialize.stringify(inst);
        }).to.not.throw(Error);

        expect(serialized).to.be.a.string;
    });

    it("can serialize and deserialize null", function() {
        expect(Serialize.stringify(null)).to.be.equal("null");
        expect(Serialize.parse("null")).to.be.equal(null);
    });

    it("can deserialize user-defined objects", function() {
        Serialize.register(TestClass);
        var inst = new TestClass(random()),
            serialized = Serialize.stringify(inst),
            deserialized;

        expect(function() {
            deserialized = Serialize.parse(serialized);
        }).to.not.throw(Error);

        expect(deserialized).to.be.an.instanceOf(TestClass);
        expect(deserialized).to.have.property('test', inst.test);
    });

    it('can serialize plain objects', function() {
        const object = {a: 1, b: 2};

        expect(function() {
            Serialize.stringify(object)
        }).to.not.throw();
    })

    it("honors user-defined toJSON functions", function() {
        Serialize.register(TestClassB);
        var inst = new TestClassB(random()),
            json = JSON.stringify(inst);

        expect(Serialize.stringify(inst)).to.be.equal(json);
    });

    it("honors the fromJSON static function on any registered constructors", function() {
        Serialize.register(TestClassB);
        var inst = new TestClassB(random()),
            json = Serialize.stringify(inst),
            parsed = Serialize.parse(json),
            keys = Object.keys(inst);

        expect(parsed.fromJSONd).to.be.true;
        expect(parsed).to.have.property('test', inst.test);
    });

    it('walks the prototype chain', function() {
        Serialize.register(TestClass);
        const key = Serialize.getKey(TestClass);
        const serialized = Serialize.stringify(new TestClassA(4));
        const json       = JSON.parse(serialized);

        expect(json).to.have.a.property(key);
        expect(json[key]).to.be.an('object');
    });

    describe('wrapConstructor', function() {
        it('wraps objects with registered constructors', function() {
            Serialize.register(TestClass);
            const object  = {a: 1};
            const wrapped = Serialize.wrapConstructor(TestClass, object);
            expect(wrapped).to.be.an('object');
            expect(wrapped).to.have.a.property(Serialize.getKey(TestClass));
            expect(wrapped[Serialize.getKey(TestClass)]).to.equal(object);
        });

        it('only wraps registered constructors', function() {
            expect(function() {
                Serialize.wrapConstructor(TestClass, {a: 1})
            }).to.throw(Error);
        })
    });
});
