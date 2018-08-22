module.exports = RED => {
    function addParticipant(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.convId = n.convId;
        node.server = RED.nodes.getNode(n.server); 
        node.server.subscribe(node.id, 'state', state => node.status(state));
        
        node.on('input', msg => {
            if (msg.payload.convId) {
                node.convId = msg.payload.convId;
            }

            if (node.server.connected) {
                node.server.client.addParticipant(node.convId, msg.payload.userIds, msg.payload.addToCall ? msg.payload.addToCall : false)
                    .then(conversation => {
                        node.log('user added');
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
    RED.nodes.registerType('addParticipant', addParticipant);
}