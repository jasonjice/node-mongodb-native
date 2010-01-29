var tcp = require("tcp");
var sys = require("sys");

Connection = function(host, port, autoReconnect) {    
  this.host = host;
  this.port = port;
  
  this.autoReconnect = autoReconnect;
  this.drained = true;
  // Reconnect buffer for messages
  this.messages = [];
  // Set up the process
  process.EventEmitter.call(this);
  // Message sender
  var self = this;
  // Status messages
  this.sizeOfMessage = 0;
  this.bytesRead = 0; 
  this.buffer = '';
}

// Some basic defaults
Connection.DEFAULT_PORT = 27017;

// Set basic prototype
Connection.prototype = new process.EventEmitter();

// Functions for the connection
Connection.prototype.open = function() {
  // Assign variable to point to local scope object
  var self = this;
  // Create the associated connection
  this.connection = tcp.createConnection(this.port, this.host);
  // Set up the tcp client
  this.connection.setEncoding("binary");
  // Add connnect listener
  this.connection.addListener("connect", function() {
    this.setEncoding("binary");
    this.setTimeout(0);
    this.setNoDelay();
    self.emit("connect");
  });
  // Add a close listener
  this.connection.addListener("close", function() {
    self.emit("close");
  });
  
  // Listener for receive data
  this.receiveListener = function(result) {
    // Check if we have an unfinished message
    if(self.bytesRead > 0 && self.sizeOfMessage > 0) {
      // Calculate remaing bytes to fetch
      var remainingBytes = self.sizeOfMessage - self.bytesRead;
      // Check if we have multiple packet messages and save the pieces otherwise emit the message
      if(remainingBytes > result.length) {
        self.buffer = self.buffer + result; self.bytesRead = self.bytesRead + result.length;        
      } else {
        // Cut off the remaining message
        self.buffer = self.buffer + result.substr(0, remainingBytes);
        // Emit the message
        self.emit("receive", [self.buffer]);              
        // Reset the variables
        self.buffer = ''; self.bytesRead = 0; self.sizeOfMessage = 0;
        // If message is longer than the current one, keep parsing
        if(remainingBytes < result.length) {
          self.receiveListener(result.substr(remainingBytes, (result.length - remainingBytes)));
        }
      }
    } else {
      var sizeOfMessage = BinaryParser.toInt(result.substr(0, 4));
      // We got a partial message, store the result and wait for more
      if(sizeOfMessage > result.length) {
        self.buffer = self.buffer + result; self.bytesRead = result.length; self.sizeOfMessage = sizeOfMessage;
      } else if(sizeOfMessage == result.length) {
        self.emit("receive", [result]);              
      } else if(sizeOfMessage < result.length) {
        self.emit("receive", [result.substr(0, sizeOfMessage)]);
        self.receiveListener(result.substr(sizeOfMessage, (result.length - sizeOfMessage)));
      }
    }
  }  
  
  // Add a receieved data connection
  this.connection.addListener("receive", this.receiveListener);  
}

Connection.prototype.close = function() {
  if(this.connection) this.connection.close();
}

Connection.prototype.send = function(command) {
  var self = this;
  
  // Check if the connection is closed
  try {
    this.connection.send(command.toBinary(), "binary");        
  } catch(err) {
    // Check if the connection is closed
    if(this.connection.readyState != "open" && this.autoReconnect) {
      // Add the message to the queue of messages to send
      this.messages.push(command);
      // Initiate reconnect if no current running
      if(this.connection.currently_reconnecting == null) {
        this.connection.currently_reconnecting = true;
        // Create the associated connection
        var new_connection = tcp.createConnection(this.port, this.host);
        // Set up the tcp client
        new_connection.setEncoding("binary");
        // Add connnect listener
        new_connection.addListener("connect", function() {
          this.setEncoding("binary");
          this.setTimeout(0);
          this.setNoDelay();
          // Add the listener
          this.addListener("receive", self.receiveListener);            
          // assign the new ready connection
          self.connection = this;
          // send all the messages
          while(self.messages.length > 0) {
            this.send(self.messages.shift().toBinary(), "binary");
          }
        });        
      }
   } else {
      throw err;
    }
  }
}

Server = function(host, port, options) {
  this.host = host;
  this.port = port;
  this.options = options == null ? {} : options;
  this.internalConnection;
  this.internalMaster = false;
}
Server.prototype = {
  get autoReconnect() {
    return this.options['autoReconnect'] == null ? false : this.options['autoReconnect']
  },
  set connection(connection) { this.internalConnection = connection; },
  get connection() { return this.internalConnection; },
  set master(value) { this.internalMaster = value; },
  get master() { return this.internalMaster; },
  get masterConnection() { return (this.internalMaster == true) ? this.internalConnection : null; },
  get autoReconnect() { return this.options['auto_reconnect'] == null ? false : this.options['auto_reconnect']; }
};
Server.prototype.close = function(callback) {
  this.connection.close(callback);
}

// Server pair object used to support a failover connection set
ServerPair = function(leftServer, rightServer) {
  if(leftServer == null || rightServer == null || !(leftServer instanceof Server) || !(rightServer instanceof Server)) {
    throw Error("Both left/right must be defined and off the type Server");
  }  
  this.leftServer = leftServer;
  this.rightServer = rightServer;
  // Containst the master server entry
  this.master = null;
  this.target = null;
}
ServerPair.MASTER = 0;
ServerPair.SHADOW_MASTER = 1;

ServerPair.prototype = {
  get masterConnection() { 
    if(this.target != null && this.target instanceof Server) return this.target.masterConnection;
    if(this.leftServer.master) return this.leftServer.masterConnection;
    if(this.rightServer.master) return this.rightServer.masterConnection;
    return null;
  },
  get autoReconnect() {
    if(this.target != null) return this.target.autoReconnect;
    if(this.masterConnection != null) return this.masterConnection.autoReconnect;
  }
}
ServerPair.prototype.setTarget = function(target) {
  this.target = target;
  this.servers = [];
}

// Server cluster (one master and multiple read slaves)
ServerCluster = function(servers) {  
  // Containst the master server entry
  this.master = null;
  this.target = null;
  
  if(servers.constructor != Array || servers.length == 0) {        
    throw Error("The parameter must be an array of servers and contain at least one server");
  } else if(servers.constructor == Array || servers.length > 0) {
    var count = 0;
    servers.forEach(function(server) {
      if(server instanceof Server) count = count + 1;
    })       
    
    if(count < servers.length) {
      throw Error("All server entries must be of type Server");      
    } else {
      this.servers = servers;      
    }
  }  
}
ServerCluster.prototype = {
  get masterConnection() {     
    // Allow overriding to a specific connection
    if(this.target != null && this.target instanceof Server) {
      return this.target.masterConnection;
    } else {
      var finalServer = null;
      this.servers.forEach(function(server) {
        if(server.master == true) finalServer = server;
      });
      return finalServer != null ? finalServer.masterConnection : finalServer;      
    }
  },
  get autoReconnect() {
    if(this.target != null) return this.target.autoReconnect;
    if(this.masterConnection != null) return this.masterConnection.autoReconnect;
  }  
}
ServerCluster.prototype.setTarget = function(target) {
  this.target = target;
}