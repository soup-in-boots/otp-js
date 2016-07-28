const Scheduler = require('./scheduler.js');

process.on('uncaughtException', (e) => console.log(e.stack));

new Scheduler();
