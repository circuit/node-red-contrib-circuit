module.exports = function(RED) {
    //incoming circuit events
    function Events(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.server = RED.nodes.getNode(n.server);
        node.callEvent = n.callEvent;
        node.convEvent = n.convEvent;
        node.itemEvent = n.itemEvent;
        node.userEvent = n.userEvent;
        
        node.server.subscribe(node.id, 'state', state => {
            node.status({fill: (state === 'Connected') ? 'green' : 'red', shape: 'dot', text: state});
        });

        if (node.callEvent) {
            node.server.subscribe(node.id, 'callStatus', evt => { node.send({ payload: evt }); });
            node.server.subscribe(node.id, 'callIncoming', evt => { node.send({ payload: evt }); });
            node.server.subscribe(node.id, 'callEnded', evt => { node.send({ payload: evt }); });
        }
        if (node.convEvent) {
            node.server.subscribe(node.id, 'conversationUpdated', evt => { node.send({ payload: evt }); });
            node.server.subscribe(node.id, 'conversationCreated', evt => { node.send({ payload: evt }); });
        }
        if (node.itemEvent) {
            node.server.subscribe(node.id, 'itemAdded', evt => { node.send({ payload: evt }); });
            node.server.subscribe(node.id, 'itemUpdated', evt => { node.send({ payload: evt }); });
        }
        if (node.userEvent) {
            node.server.subscribe(node.id, 'userSettingsChanged', evt => { node.send({ payload: evt }); });
            node.server.subscribe(node.id, 'userUpdated', evt => { node.send({ payload: evt }); });
        }
    }
    RED.nodes.registerType('Events', Events);
}
