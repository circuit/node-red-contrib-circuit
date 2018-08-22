module.exports = RED => {
    function getConversations(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.server = RED.nodes.getNode(n.server);      
        node.server.subscribe(node.id, 'state', state => node.status(state));
        
        node.on('input', msg => {

            if (node.server.connected) {
                node.server.client.getConversations(msg.payload.options)
                    .then(convs => {
                        node.log('getConversationsByIds returned ' + ((convs && convs.length) ? `${convs.length} conversations` : 'no conversations'));
                        msg.payload = convs;
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
    RED.nodes.registerType('getConversations', getConversations);
}