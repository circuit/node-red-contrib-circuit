module.exports = RED => {
    function createGroupConversation(n) {
        const util = require('util');
        RED.nodes.createNode(this, n);
        let node = this;
        node.server = RED.nodes.getNode(n.server);      
        node.server.subscribe(node.id, 'state', state => node.status(state));
        node.on('input', msg => {

            if (node.server.connected) {
                node.server.client.createGroupConversation(msg.payload.participants || [], msg.payload.topic)
                    .then(conversation => {
                        node.log('conversation created.');
                        msg.payload = conversation;
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
    RED.nodes.registerType('createGroupConversation', createGroupConversation);
}