module.exports = RED => {
    function startUserSearch(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.search = n.search || '';
        node.server = RED.nodes.getNode(n.server);
        
        node.server.subscribe(node.id, 'state', state => node.status(state));

        node.server.subscribe(node.id, 'basicSearchResults', evt => {
            if (evt.data && evt.data.users) {
                node.server.client.getUsersById(evt.data.users)
                    .then(users => {
                        node.log(util.inspect(users, { showHidden: true, depth: null }));
                        evt.data.users = users;
                        node.send({ payload: evt });
                    })
                    .catch(err => {
                        node.error(util.inspect(err, { showHidden: true, depth: null }));
                        node.send({ payload: err });
                    });
            }
        });
        
        node.on('input', msg => {
            if (node.server.connected) {
                node.server.client.startUserSearch((typeof msg.payload === 'string') ? ((msg.payload !== '') ? msg.payload : node.search) : node.search)
                    .then(searchId => {
                        node.log('startUserSearch with searchId ' + searchId);
                        node.send({ payload: searchId });
                    })
                    .catch(err => {
                        node.error(util.inspect(err, { showHidden: true, depth: null }));
                        node.send({ payload: err });
                    });
            } else {
                node.error('not connected to server');
            }
        });
    }
    RED.nodes.registerType('startUserSearch', startUserSearch);
}