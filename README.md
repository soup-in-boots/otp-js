# OTPJS
This presently only emulates portions of the Erlang Runtime System, specifically
around the concept of "schedulers" (implemented as distinct nodejs processes
here) and user-space processes (implemented as a distinct execution context).

I endeavor to provide a full command-line interface to launch "OTP" style
javascript applications utilizing the same concurrency model provided by
Erlang/OTP.

For the time being, the implementation is very limited. You can refer to the
files under test/mock/ for examples of basic process implementations.

I also highly recommend [sparkler](https://github.com/natefaubion/sparkler) to
be used, as it provides similar pattern matching functionality to Erlang.
Destructuring assignment in ES6 is different but also conducive to message
handling.

This project makes heavy use of ES6 features and as such requires NodeJS v6.

## Starting OTPJS
OTPJS has no index file at present, but I'll add one that provides a clean
interface for starting and interactive with OTPJS when time allows.

For the moment, you can get by with this:

```javascript
const Controller = require('otpjs/lib/controller.js'),
      os = require('os');

var controller = new Controller(os.cpus().length);
```

## Processes
### Lifecycle
As in Erlang, every process has a unique identifier associated with it, as well
as message queues.

Process lifecycles are tracked through Promises. To achieve this, we do a
terrible thing and extend the built-in Promise object in spawned processes. The
extension is very simple and acts as a reference counter. As long as you have an
unresolved Promise in the context of your process it will be considered to be
alive.

#### Spawning
The Controller provides a "spawn" function which takes a path to a module as its
argument.  This module is executed *as* the process. This may change in the
future.

```javascript
controller.spawn("path/to/my/module.js");
```

Apart from invoking `controller.spawn` from your entry module, from within a
process you can spawn another via the globally defined `spawn(module)`
function. This function returns a promise which resolves with the pid of the
newly spawned process.

```javascript
spawn("path/to/module.js").then(function(pid) {
    send(pid, "hello!");
});
```

You will be able to pass arguments to spawned processes. The feature remains
unimplemented at the moment. Once it is, it will be subject to the same
restrictions regarding message-passing detailed below.

#### Message Passing
Processes are run in distinct contexts with a few globals defined to facilitate
message-passing.

##### self()
Retrieves the ProcessIdentifier for the currently executing process.

```javascript
console.log(self()); // ProcessIdentifier { ... }
```

##### send(pid, message)
Sends a message to the process identified by `pid`.

```javascript
spawn("path/to/module.js").then(function(pid) {
    send(pid, "hello!");
});
```

##### receive()
Returns a promise. The promise is resolved with the next message received. In
the future, this may be able to provide pattern matching (e.g., via sparkler).

Right now it is technically possible to call receive consecutively (e.g., before
the first is resolved). I will be making this throw an error.

```javascript
receive().then(function(message) {
    console.log(message); // hello!
});
```
##### RESTRICTIONS

###### Functions and Closures
NodeJS processes (node(\\.exe)?) do not share a heap. OTPJS relies on spawning
multiple node processes to facilitate concurrency, similar to how Erlang runs a
scheduler thread for each CPU (or as configured). Whereas Erlang is able to pass
messages between schedulers in-process, OTPJS is limited to passing messages via
the stdin/out/err file descriptors, and must be serialized as a result.

Because of this serialization process, *you cannot pass closures between
processes*. I intend to allow the passing of basic functions via special
serialization, but even with that any function which relies on a closure will
error on the receiving end. This is due to the loss of the function's *scope*.

I have investigated the possibility of serializing a function's scope, but
without any luck in finding a means to investigate a function object's bound
scope in V8. If anyone else knows of some means to do so, do tell. The rest can
be handled by kludging together an AST, finding undefined identifiers, and
replacing them with whatever is available in the function's bound scope at the
time of serialization (after similarly resolving said value, if necessary).

###### Class Instances
OTPJS messages are (unfortunately) serialized into JSON before being passed from
one process to another. This introduces difficulties in passing class instances,
because the instance loses its prototype information when converted to JSON. To
work around this, OTPJS uses a slightly-customized `JSON` object to spawned
processes.

Specifically, a "replacer" function is added. You can utilize this replacer by
registering your class with it. This adds meta-information to the JSON of any
registered class instance that tells the receiving end how to construct the
object. The receiving end can only do this if it *also* has the class
registered.

If your class provides its own `toJSON` function, this will be invoked before
the replacer function has a chance to intercept the object and add
meta-information. To work around this, use `JSON.wrapConstructor(Constructor,
json)`.


### Require
Require inside processes does not use the built-in NodeJS require functionality.
We break this so we can override built-ins like Promise in required modules
(this also means required modules are local to a process, and so will be
initialized many times in separate contexts).
