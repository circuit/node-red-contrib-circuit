 
module.exports = RED => {
    const util = require('util');
    const Circuit = require('circuit-sdk');
    const url = require('url');

    function CircuitServerNode(n) {
        RED.nodes.createNode(this, n);
        if (!n || !n._users || !n._users.length) {
            // if no nodes use this server return
            return;
        }
        let node = this;
        node.domain = n.domain;
        node.scope = n.allowScope && n.scope ||'ALL';
        node.clientid = n.clientid;
        node.clientsecret = n.clientsecret;
        node.loglevel = n.loglevel || 'Error';
        node.connected = false;
        node.state = Circuit.Enums.ConnectionState.Disconnected;
        node.reconnectCount = 0;
        node.subscriptions = {};
        node.user = null;
        
        if (!node.client) {
            if (process.env.http_proxy) {
                var HttpsProxyAgent = require('https-proxy-agent');
                Circuit.NodeSDK.proxyAgent = new HttpsProxyAgent(url.parse(process.env.http_proxy));
                node.log(`Using proxy ${process.env.http_proxy}`);
            }
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
            if (node.client && !node.connected) {
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
            if (evt.state == Circuit.Enums.ConnectionState.Connected) {
                node.connected = true;
            } else {
                if (evt.state === Circuit.Enums.ConnectionState.Disconnected) {
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
            if (node.reconnectCount++ > 4) {
                node.client.logout();
            }
        });
        // event listeners for "logging only" generic events
        ['accessTokenRenewed', 'sessionTokenRenewed'].forEach(elem => node.client.addEventListener(elem, evt => node.log(util.inspect(evt, { showHidden: true, depth: null }))));
        // event listeners for "logging only" error events
        ['renewAccessTokenFailed', 'renewSessionTokenFailed'].forEach(elem => node.client.addEventListener(elem, evt => node.error(util.inspect(evt, { showHidden: true, depth: null }))));
        // event listeners for all events that need to be "broadcasted" to all nodes.
        ['callStatus', 'callIncoming', 'callEnded', 'conversationUpdated', 'conversationCreated', 'itemUpdated', 'itemAdded',
         'userSettingsChanged', 'userUpdated', 'userPresenceChanged', 'basicSearchResults']
        .forEach(elem => node.client.addEventListener(elem, evt => node.broadcast(elem, evt)));
        
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
                    node.subscriptions[s][type]({fill: data === Circuit.Enums.ConnectionState.Connected ? 'green' : 'red', shape: 'dot', text: data});
                }
            }
        };
        
        if (!node.connected) {
            node.logon();
        }        
        this.on('close', () => {
            node.log('log out ' + node.clientid + ' from domain: ' + node.client.domain);
            node.client.removeAllListeners();
            node.client.logout();
            delete node.client;
        });
    }
    RED.nodes.registerType('circuit-server', CircuitServerNode);
};