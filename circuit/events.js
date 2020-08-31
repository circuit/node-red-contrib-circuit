module.exports = RED => {
    function Events(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.server = RED.nodes.getNode(n.server);
        node.callEvent = n.callEvent;
        node.convEvent = n.convEvent;
        node.itemEvent = n.itemEvent;
        node.userEvent = n.userEvent;
        node.formEvent = n.formEvent;
        node.server.subscribe(node.id, 'state', state => node.status(state));

        if (node.callEvent) {
            node.server.subscribe(node.id, 'callStatus', evt => node.send({ payload: evt.text }));
            node.server.subscribe(node.id, 'callIncoming', evt => node.send({ payload: evt.text }));
            node.server.subscribe(node.id, 'callEnded', evt => node.send({ payload: evt.text }));
        }
        if (node.convEvent) {
            node.server.subscribe(node.id, 'conversationUpdated', evt => node.send({ payload: evt.text }));
            node.server.subscribe(node.id, 'conversationCreated', evt => node.send({ payload: evt.text }));
        }
        if (node.itemEvent) {
            node.server.subscribe(node.id, 'itemAdded', evt => node.send({ payload: evt.text }));
            node.server.subscribe(node.id, 'itemUpdated', evt => node.send({ payload: evt.text }));
        }
        if (node.userEvent) {
            node.server.subscribe(node.id, 'userSettingsChanged', evt => node.send({ payload: evt.text }));
            node.server.subscribe(node.id, 'userUpdated', evt => node.send({ payload: evt.text }));
        }
        if (node.formEvent) {
            node.server.subscribe(node.id, 'formSubmission', evt => node.send({payload: evt.text}));
        }
    }
    RED.nodes.registerType('Events', Events);
}
