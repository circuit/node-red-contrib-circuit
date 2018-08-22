module.exports = RED => {
    function setPresence(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.server = RED.nodes.getNode(n.server);      
        node.server.subscribe(node.id, 'state', state => node.status(state));
        
        node.on('input', msg => {
            if (node.server.connected) {
                node.server.client.setPresence(msg.payload.presence)    
                    .catch(err => {
                        node.error(util.inspect(err, { showHidden: true, depth: null }));
                        node.send({ payload: err });
                    });
            } else {
                node.error('not connected to server');
            }
        });
    }
    RED.nodes.registerType('setPresence', setPresence);
}