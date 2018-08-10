 
module.exports = (RED) => {
    const util = require('util');
    const Circuit = require('circuit-sdk');
    
    // handle the connection to the circuit server
    function CircuitServerNode(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.domain = n.domain;
        node.scope = n.allowScope && n.scope ? n.scope : 'ALL';
        node.clientid = n.clientid;
        node.clientsecret = n.clientsecret;
        node.loglevel = n.loglevel || 'Error';
        node.connected = false;
        node.state = 'Disconnected';
        node.reconnectCount = 0;
        node.subscriptions = {};
        node.user = null;
        
        if (!node.client) {
            node.client = new Circuit.Client({
                domain: node.domain,
                client_id: node.clientid,
                client_secret: node.clientsecret,
                autoRenewToken: true,
                scope: node.scope
            });
        }
        
        Circuit.logger.setLevel(Circuit.Enums.LogLevel[node.loglevel]);
        
        node.logon = () => {
            node.log('node.logon()');
            if (node.client && node.connected === false) {
                node.connected = true;
                node.client.logon()
                    .then(user => {
                        node.connected = true;
                        node.reconnectCount = 0;
                        node.user = user;
                        node.log('user ' + node.clientid + ' logged on at domain ' + node.client.domain + ' (' + user.displayName + ')');
                    })
                    .catch(err => {
                        node.connected = false;
                        node.error(util.inspect(err, { showHidden: true, depth: null }));
                        node.warn('Logon failed. retrying 15 seconds >' + node.clientid + '< >' + node.client.domain + '<');
                        setTimeout(() => {
                            (node && node.logon && !node.connected) ? node.logon() : node.error('node.logon() does not exist. Logon failed. Aborting');
                        }, 15000);
                    });
            }
        };
        
        // event listener for connectionStateChanged events. handles data in node.state and node.connected
        node.client.addEventListener('connectionStateChanged', evt => {
            node.log(util.inspect(evt, { showHidden: true, depth: null }));
            node.state = evt.state;
            if (evt.state == 'Connected') {
                node.connected = true;
            } else {
                if (evt.state === 'Disconnected') {
                    node.connected = false;
                    node.error('Disconnected. trying to logon: ' + node.clientid + ' domain: ' + node.client.domain);
                    node.logon();
                }
            }
            node.broadcast('state', node.state);
        });
        // event listener for reconnectFailed events. after 10 reconnectFailed events, we will try a complete new login
        node.client.addEventListener('reconnectFailed', evt => {
            node.error(util.inspect(evt, { showHidden: true, depth: null }));
            node.reconnectCount++;
            if (node.reconnectCount > 4) {
                node.client.logout();
            }
        });
        // event listeners for "logging only" generic events
        ['accessTokenRenewed', 'sessionTokenRenewed'].forEach((elem, index, arr) => {
            node.client.addEventListener(elem, evt => node.log(util.inspect(evt, { showHidden: true, depth: null })));
        });
        // event listeners for "logging only" error events
        ['renewAccessTokenFailed', 'renewSessionTokenFailed'].forEach((elem, index, arr) => {
            node.client.addEventListener(elem, evt => node.error(util.inspect(evt, { showHidden: true, depth: null })));
        });
        // event listeners for all events that need to be "broadcasted" to all nodes.
        ['callStatus', 'callIncoming', 'callEnded', 'conversationUpdated', 'conversationCreated', 'itemUpdated', 'itemAdded',
         'userSettingsChanged', 'userUpdated', 'userPresenceChanged', 'basicSearchResults']
        .forEach((elem, index, arr) => {
            node.client.addEventListener(elem, evt => node.broadcast(elem, evt));
        });
        
        // subscribe and unsubscribe handling
        node.subscribe = (id, type, cb) => {
            node.log('receive subscribe for >' + type + '< from >' + id + '<');
            node.subscriptions[id] = node.subscriptions[id] || {};
            node.subscriptions[id][type] = cb;
            if (type === 'state') {
                node.broadcast('state', node.state);
            }
        };
        node.unsubscribe = (id, type) => {
            if (node.subscriptions[id].hasOwnProperty(type)) {
                delete node.subscriptions[id][type];
            }
            if (Object.keys(node.subscriptions[id]).length === 0 || type === '') {
                delete node.subscriptions[id];
            }
        };
        // broadcast events to subscribed nodes
        node.broadcast = (type, data) => {
            node.log('broadcasting to all >' + type + '< listeners:\n' + util.inspect(data, { showHidden: true, depth: null }));
            for (var s in node.subscriptions) {
                if (node.subscriptions[s].hasOwnProperty(type)) {
                    node.log('listener for >' + type + '< at node >' + s + '<');
                    node.subscriptions[s][type](data);
                }
            }
        };
        
        node.logon();
        
        this.on('close', () => {
            node.log('log out ' + node.clientid + ' from domain: ' + node.client.domain);
            node.client.removeAllListeners();
            node.client.logout();
            delete node.client;
        });
    }
    RED.nodes.registerType('circuit-server', CircuitServerNode);
    
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
        
        node.on('close', () => {
            node.server.unsubscribe(node.id, 'state');
            node.send({ payload: {state: 'stopping'} });
        });
    }
    RED.nodes.registerType('addTextItem', addTextItem);
    
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
        
        node.on('close', () => {
            node.server.unsubscribe(node.id, 'state');
            node.send({ payload: {state: 'stopping'} });
        });
    }
    RED.nodes.registerType('updateTextItem',updateTextItem);
    
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
        
        node.on('close', () => {
            node.server.unsubscribe(node.id, '');
            node.send({ payload: {state: 'stopping'} });
        });
    }
    RED.nodes.registerType('Events', Events);
    
    //getConversationItems 
    function getConversationItems(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.convId = n.convId || '';
        node.server = RED.nodes.getNode(n.server);
        
        node.server.subscribe(node.id, 'state', (state) => {
            node.status({fill: (state === 'Connected') ? 'green' : 'red',shape:'dot',text:state});
        });
        
        node.on('input', msg => {
            if (msg.payload.convId) {
                node.convId = msg.payload.convId;
            }
            if (node.server.connected) {
                node.server.client.getConversationItems(node.convId, msg.payload.options)
                    .then((items) => {
                        node.log('getConversationItems returned ' + items.length + ' items');
                        msg.payload = items;
                        node.send(msg);
                    })
                    .catch((err) => {
                        node.error(util.inspect(err, { showHidden: true, depth: null }));
                        msg.payload = err;
                        node.send(msg);
                    });
            } else {
                node.error('not connected to server');
            }
        });
        
        node.on('close', () => {
            node.server.unsubscribe(node.id, 'state');
            node.send({ payload: {state: 'stopping'} });
        });
    }
    RED.nodes.registerType('getConversationItems', getConversationItems);
    
    //startUserSearch
    function startUserSearch(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.search = n.search || '';
        node.server = RED.nodes.getNode(n.server);
        
        node.server.subscribe(node.id, 'state', state => {
            node.status({fill: (state === 'Connected') ? 'green' : 'red', shape: 'dot', text: state});
        });
        
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
        
        node.on('close', () => {
            node.server.unsubscribe(node.id, '');
            node.send({ payload: {state: 'stopping'} });
        });
    }
    RED.nodes.registerType('startUserSearch', startUserSearch);
    
    //getDirectConversationWithUser 
    function getDirectConversationWithUser(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.server = RED.nodes.getNode(n.server);
        
        node.server.subscribe(node.id, 'state', state => {
            node.status({fill: (state === 'Connected') ? 'green' : 'red', shape: 'dot', text: state});
        });
        
        node.on('input', msg => {
            if (node.server.connected) {
                if (typeof msg.payload === 'string') {
                    msg.payload = {
                        userId: msg.payload,
                        create: false
                    }
                }
                node.server.client.getDirectConversationWithUser(msg.payload.userId, msg.payload.create)
                    .then(conv => {
                        node.log('getDirectConversationWithUser returned ' + ((conv && conv.convId) ? ' conversation' + conv.convId : 'no conversation'));
                        msg.payload = conv;
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
        
        node.on('close', () => {
            node.server.unsubscribe(node.id, 'state');
            node.send({ payload: {state: 'stopping'} });
        });
    }
    RED.nodes.registerType('getDirectConversationWithUser', getDirectConversationWithUser);

    //getConversationsByIds 
    function getConversationsByIds(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.server = RED.nodes.getNode(n.server);
        
        node.server.subscribe(node.id, 'state', state => {
            node.status({fill: (state === 'Connected') ? 'green' : 'red', shape: 'dot', text: state});
        });
        
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
        
        node.on('close', () => {
            node.server.unsubscribe(node.id, 'state');
            node.send({ payload: {state: 'stopping'} });
        });
    }
    RED.nodes.registerType('getConversationsByIds', getConversationsByIds);
};