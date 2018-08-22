module.exports = RED => {
    function getConversationsByIds(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.server = RED.nodes.getNode(n.server);       
        node.server.subscribe(node.id, 'state', state => node.status(state));

        node.on('input', msg => {
            if (node.server.connected) {
                let convIds = [];
                if (msg.payload.convIds && typeof msg.payload.convIds === 'string') {
                    convIds.push(msg.payload.convIds);
                } else if (Array.isArray(msg.payload.convIds)) {
                    convIds = msg.payload.convIds;
                }
                if (!convIds.length) {
                    node.log('No convIds to return.');
                    node.send({payload: []});
                }
                node.server.client.getConversationsByIds(convIds)
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
    RED.nodes.registerType('getConversationsByIds', getConversationsByIds);
}