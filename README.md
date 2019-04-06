# OTPJS
[![Build Status](https://travis-ci.com/fauxsoup/otp-js.svg?branch=master)](https://travis-ci.com/fauxsoup/otp-js)

This project makes heavy use of ES6 features and as such requires NodeJS v10

This is an endeavor to replicate the Open Telecom Platform in NodeJS. You should
probably use *either* NodeJS or Erlang. This is a project for fun, not for
production.

This project uses the awesome ImmutableJS library internally.

## Starting OTPJS
For example, this script would print the string "Hello world"

```javascript
const {create_node} = require('open-telecom');
const {OTPNode} = create_node();
const node = new OTPNode();

const pid = node.spawn(async (ctx) => {
        const message = await ctx.receive();
        console.log("Hello %s", message);
    });

node.spawn(async (ctx) => {
        ctx.send(pid, "world");
    })
```

## Processes
### Lifecycle
As in Erlang, every process has a unique identifier associated with it, as well
as message queues. 

Process lifecycles are tracked through Promises. As long as you have an
unresolved Promise in your context it will be considered to be alive. Once your
promise chain ends, your context is considered to be dead! In this way, think of
your context as an Erlang process.

## Library
### proc_lib
A limited `proc_lib` implementation is defined.

### gen_server
A limited `gen_server` implementation is defined.

### Roadmap
Finish `proc_lib` and `gen_server`. Develop `supervisor`, `gen_fsm`,
`gen_event`, etc.
