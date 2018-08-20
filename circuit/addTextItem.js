module.exports = function(RED) {
    //handle outgoing text messages to circuit
    function addTextItem(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.convId = n.convId;
        node.server = RED.nodes.getNode(n.server);
        
        node.server.subscribe(node.id, 'state', state => {
            node.status({fill: (state === 'Connected') ? 'green' : 'red', shape: 'dot', text: state});
        });
        
        node.on('input', (msg) => {
            if (msg.payload.convId) {
                node.convId = msg.payload.convId;
            }
            if (node.server.connected) {
                node.server.client.addTextItem(node.convId, msg.payload.content)
                    .then(item => {
                        node.log('message sent');
                        msg.payload = item;
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
    RED.nodes.registerType('addTextItem', addTextItem);
}