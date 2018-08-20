module.exports = function(RED) {
    //handle outgoing update to text messages to circuit
    function updateTextItem(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.server = RED.nodes.getNode(n.server);
        
        node.server.subscribe(node.id, 'state', state => {
            node.status({fill: (state === 'Connected') ? 'green' : 'red', shape: 'dot', text: state});
        });
        
        node.on('input', msg => {
            if (node.server.connected) {
                node.server.client.updateTextItem(msg.payload)
                    .then(item => {
                        node.log('item updated');
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
    RED.nodes.registerType('updateTextItem',updateTextItem);
}