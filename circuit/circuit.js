 
module.exports = (RED) => {
    const util = require('util');
    const Circuit = require('circuit');
    
    // handle the connection to the circuit server
    function CircuitServerNode(n) {
        RED.nodes.createNode(this,n);
        let node = this;
        node.domain = n.domain;
        node.clientid = n.clientid;
        node.clientsecret = n.clientsecret;
        node.allowFirstname = n.allowFirstname;
        node.firstname = n.firstname;
        node.allowLastname = n.allowLastname;
        node.lastname = n.lastname;
        node.allowStatusMsg = n.allowStatusMsg;
        node.statusMsg = n.statusMsg;
        node.connected = false;
        node.state = "Disconnected";
        node.reconnectCount = 0;
        node.renewTokenLoop = false;
        node.subscriptions = {};
        node.user = null;
        
        if (!node.client) {
            node.client = new Circuit.Client({
                domain: node.domain,
                client_id: node.clientid,
                client_secret: node.clientsecret,
                scope: 'ALL'
            });
        }
        
        node.logon = () => {
            node.log('node.logon()');
            if (node.connected === false) {
                node.client.logon()
                .then((user) => {
                    node.connected = true;
                    node.reconnectCount = 0;
                    node.user = user;
                    node.log('user ' + node.clientid + ' logged on at domain ' + node.client.domain + ' (' + user.displayName + ')');
                    node.log(util.inspect(node.client, { showHidden: true, depth: null }));
                    node.client.setPresence({state: Circuit.Constants.PresenceState.AVAILABLE})
                    .then(() => node.log('set presence state to ' + Circuit.Constants.PresenceState.AVAILABLE))
                    .catch((err) => node.error(util.inspect(err, { showHidden: true, depth: null })));
                    node.updateUser();
                })
                .catch((err) => {
                    node.connected = false;
                    node.error(util.inspect(err, { showHidden: true, depth: null }));
                    node.warn('Logon failed. retrying 30 seconds >' + node.clientid + '< >' + node.client.domain + '<');
                    setTimeout(() => {
                        (node && node.logon) ? node.logon() : node.error('node.logon() does not exist. Logon failed. Aborting');
                    },30000);
                });
            }
        };
        
        node.updateUser = () => {
            let userObj = {};
            if (node.allowFirstname && node.firstname != node.user.firstName) {
                userObj.firstName = node.firstname;
            }
            if (node.allowLastname && node.lastname != node.user.lastName) {
                userObj.lastName = node.lastname;
            }
            if (Object.keys(userObj).length > 0) {
                userObj.userId = node.user.userId;
                node.client.updateUser(userObj)
                .then(() => node.log('updated user data: ' + util.inspect(userObj, { showHidden: true, depth: null })))
                .catch((err) => node.error(util.inspect(err, { showHidden: true, depth: null })));
            }
            if (node.allowStatusMsg) {
                node.client.setStatusMessage(node.statusMsg)
                .then(() => node.log('Status message set: ' + node.statusMsg))
                .catch((err) => node.error(util.inspect(err, { showHidden: true, depth: null })));
            }
        };
        
        node.client.addEventListener('connectionStateChanged', (evt) => {
            node.log(util.inspect(evt, { showHidden: true, depth: null }));
            node.state = evt.state;
            (evt.state === 'Connected') ? node.connected = true : node.connected = false;
            if (evt.state == 'Disconnected') {
                node.error('Disconnected. trying to logon: ' + node.clientid + ' domain: ' + node.client.domain);
                node.logon();
            }
            node.broadcast('state', node.state);
        });
        node.client.addEventListener('reconnectFailed', (evt) => {
            node.error(util.inspect(evt, { showHidden: true, depth: null }));
            node.reconnectCount ++;
            if (node.reconnectCount >= 10) {
                node.client.logout();
            }
        });
        node.client.addEventListener('sessionExpires', (evt) => {
            node.error(util.inspect(evt, { showHidden: true, depth: null }));
        });
        node.client.addEventListener('renewToken', (evt) => {
            node.error(util.inspect(evt, { showHidden: true, depth: null }));
        });
        
        node.client.addEventListener('callStatus',          evt => node.broadcast('callStatus', evt));
        node.client.addEventListener('callIncoming',        evt => node.broadcast('callIncoming', evt));
        node.client.addEventListener('callEnded',           evt => node.broadcast('callEnded', evt));
        node.client.addEventListener('conversationUpdated', evt => node.broadcast('conversationUpdated', evt));
        node.client.addEventListener('conversationCreated', evt => node.broadcast('conversationCreated', evt));
        node.client.addEventListener('itemUpdated',         evt => node.broadcast('itemUpdated', evt));
        node.client.addEventListener('itemAdded',           evt => node.broadcast('itemAdded', evt));
        node.client.addEventListener('userSettingsChanged', evt => node.broadcast('userSettingsChanged', evt));
        node.client.addEventListener('userUpdated',         evt => node.broadcast('userUpdated', evt));
        node.client.addEventListener('userPresenceChanged', evt => node.broadcast('userPresenceChanged', evt));
        node.client.addEventListener('basicSearchResults',  evt => node.broadcast('basicSearchResults', evt));
        
        node.subscribe = (id, type, cb) => {
            node.log('receive subscribe for >' + type + '< from >' + id + '<');
            node.subscriptions[id] = node.subscriptions[id] || {};
            node.subscriptions[id][type] = cb;
            if (type == 'state') {
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
        
        node.broadcast = (type, data) => {
            node.log('broadcasting to all >' + type + '< listeners: ' + util.inspect(data, { showHidden: true, depth: null }));
            for (var s in node.subscriptions) {
                if (node.subscriptions[s].hasOwnProperty(type)) {
                    node.log('listener for >' + type + '< at node >' + s + '<');
                    node.subscriptions[s][type](data);
                }
            }
        };
        
        node.logon();
        
        if (node.renewTokenLoop) {clearInterval(node.renewTokenLoop);}
        node.renewTokenLoop = setInterval(() => {
            node.log('renewing token: ' + node.clientid + ' domain: ' + node.client.domain);
            node.client.renewToken();
        }, 86400000);
        
        this.on('close', () => {
            node.log('log out ' + node.clientid + ' from domain: ' + node.client.domain);
            node.client.removeAllListeners();
            node.client.logout();
            delete node.client;
        });
    }
    RED.nodes.registerType("circuit-server",CircuitServerNode);
    
    //handle outgoing text messages to circuit
    function addTextItem(n) {
        RED.nodes.createNode(this,n);
        let node = this;
        node.conv = n.conv;
        node.server = RED.nodes.getNode(n.server);
        
        node.server.subscribe(node.id, 'state', function(state) {
            node.status({fill:(state == 'Connected') ? 'green' : 'red',shape:'dot',text:state});
        });
        
        node.on('input', (msg) => {
            if(node.server.connected) {
                node.server.client.addTextItem(node.conv, msg.payload)
                .then((item) => {
                    node.log('message sent');
                    msg.payload = item;
                    node.send(msg);
                })
                .catch((err) => {
                    node.error(util.inspect(err, { showHidden: true, depth: null }));
                    msg.payload = err;
                    node.send(msg);
                });
            }
            else {
                node.error('not connected to server');
            }
        });
        
        node.on('close', () => {
            node.server.unsubscribe(node.id, 'state');
            node.send({ payload: {state: 'stopping'} });
        });
    }
    RED.nodes.registerType("addTextItem",addTextItem);
    
    //incoming circuit events
    function Events(n) {
        RED.nodes.createNode(this,n);
        let node = this;
        node.server = RED.nodes.getNode(n.server);
        node.callEvent = n.callEvent;
        node.convEvent = n.convEvent;
        node.itemEvent = n.itemEvent;
        node.userEvent = n.userEvent;
        
        node.server.subscribe(node.id, 'state', function(state) {
            node.status({fill:(state == 'Connected') ? 'green' : 'red',shape:'dot',text:state});
        });

        if (node.callEvent) {
            node.server.subscribe(node.id, 'callStatus',    function(evt) { node.send({ payload: evt }); });
            node.server.subscribe(node.id, 'callIncoming',  function(evt) { node.send({ payload: evt }); });
            node.server.subscribe(node.id, 'callEnded',     function(evt) { node.send({ payload: evt }); });
        }
        if (node.convEvent) {
            node.server.subscribe(node.id, 'conversationUpdated',   function(evt) { node.send({ payload: evt }); });
            node.server.subscribe(node.id, 'conversationCreated',   function(evt) { node.send({ payload: evt }); });
        }
        if (node.itemEvent) {
            node.server.subscribe(node.id, 'itemAdded',     function(evt) { node.send({ payload: evt }); });
            node.server.subscribe(node.id, 'itemUpdated',   function(evt) { node.send({ payload: evt }); });
        }
        if (node.userEvent) {
            node.server.subscribe(node.id, 'userSettingsChanged',   function(evt) { node.send({ payload: evt }); });
            node.server.subscribe(node.id, 'userUpdated',           function(evt) { node.send({ payload: evt }); });
        }
        
        node.on('close', () => {
            node.server.unsubscribe(node.id, '');
            node.send({ payload: {state: 'stopping'} });
        });
    }
    RED.nodes.registerType("Events",Events);
    
    //getConversationItems 
    function getConversationItems(n) {
        RED.nodes.createNode(this,n);
        let node = this;
        node.conv = n.conv;
        node.server = RED.nodes.getNode(n.server);
        
        node.server.subscribe(node.id, 'state', function(state) {
            node.status({fill:(state == 'Connected') ? 'green' : 'red',shape:'dot',text:state});
        });
        
        node.on('input', (msg) => {
            if(node.server.connected) {
                node.server.client.getConversationItems(node.conv, msg.payload)
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
            }
            else {
                node.error('not connected to server');
            }
        });
        
        node.on('close', () => {
            node.server.unsubscribe(node.id, 'state');
            node.send({ payload: {state: 'stopping'} });
        });
    }
    RED.nodes.registerType("getConversationItems",getConversationItems);
};
