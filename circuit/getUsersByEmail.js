module.exports = RED => {
    function getUsersByEmail(n) {
        const util = require('util');
        RED.nodes.createNode(this, n);
        let node = this;
        node.server = RED.nodes.getNode(n.server); 
        node.server.subscribe(node.id, 'state', state => node.status(state));
        
        node.on('input', msg => {

            if (node.server.connected) {
                node.server.client.getUsersByEmail(msg.payload.emails)
                    .then(user => {
                        node.log('message sent');
                        msg.payload = user;
                        node.send(msg);
                    })
                    .catch(err => {
                        node.error(util.inspect(err, { showHidden: true, depth: null }));
                        msg.payload = err;
                        node.send(msg);
                    });
            } else {
                node.error('not connected to server');
            }
        });
    }
    RED.nodes.registerType('getUsersByEmail', getUsersByEmail);
}