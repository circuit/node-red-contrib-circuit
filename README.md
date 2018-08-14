# node-red-contrib-circuit
This node-red-contrib-circuit is simple [Node-Red](http://nodered.org) git ui that allows you to easily integrate the functionality of the circuit sdk into your applications using node-red.
## Pre-requisites
[![NodeRed](https://img.shields.io/badge/Node--Red-0.18.7-red.svg)](http://nodered.org)
[![NodeJS](https://img.shields.io/badge/Node.js-6.10.2-brightgreen.svg)](https://nodejs.org) <br/>
Requires [Node-Red](http://nodered.org) version 0.18.7 or more recent.<br/>
Requires a [https://circuitsandbox.net](https://circuitsandbox.net) account with a bot to host the application with OAuth client_credentials.
## Installations
Make sure you have NodeRed installed on your machine, if not you can install it by running the below command. <br/>
    `$ npm install -g --unsafe-perm node-red` <br/>
Then you can start node-red by typing `node-red` in the command lind. More information on node-red can be found <br/>
at the node-red github [here](https://github.com/node-red/node-red).
### Installing node-red-contrib-circuit
Either install via pallette or via "npm install".<br/>
    `$ npm install node-red-contrib-circuit` <br/>
Run the following command for global install. <br/>
    `$ npm install -g node-red-contrib-circuit` <br/>
## Getting started
1. Install both `node-red` and `node-red-contrib-circuit` as displayed above.
2. Once both packages are installed you will need a bot with OAuth client_credentials to run your application with.<br/>
You can go [here](https://circuit.github.io/) and follow the instructions to obtain your credentials.
3.  Start node-red by typing `$node-red` into the command line and wait for the server to be loaded. After node-red is running you should be able to go to `localhost:1880` to view your node-red server. If the node-red-contrib-circuit has been installed properly you should be able to scroll through your nodes and view the available API nodes to use.
4. Once everything else is working you can follow the instructions in the <b>Usage</b> section.
## Usage
1. Select node with API functionality you desire.
2. Enter the circuit-server information needed for bot, such as: `client_id`, `client_secret`, `domain`.
3. Additional information on circuit client can be found at: [https://github.com/circuit/circuit-sdk](https://github.com/circuit/circuit-sdk).
## Testing
Under development...<br/>
## License
The node is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).