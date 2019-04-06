const create_adapter = require('./cluster-slave');
const {create_node}  = require('../node');

const slave_adapter = create_adapter(process);
const {OTPNode}     = create_node(slave_adapter);
const node          = new OTPNode();

node.spawn(slave_adapter.system_process);
