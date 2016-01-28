'use strict';

// --------------------------
// Gateway.js
//
// Signaling gateway module to interconnect several WebRTC signaling server.
// With this module, each WebRTC based product can interact each other.
// For instance, janus based system can be accessed from internet via Skyway.
//
// Supported features are:
// * attaching dedicated signaling server whitch indicated by server_name (skyway or janus)
// * convert signaling server message to Common Gateway Orchestration Format (CGOF) and post to orchestrator implemented with redis
// * convert CGOF to signaling server message and post to each server.

//////////////////////////////////////////////
// load each modules for signaling server
var JanusConnector = require("./Connector/Janus.js")
  , SkywayConnector = require("./Connector/Skyway.js")
  , OrchestratorConnector = require("./Connector/Orchestrator.js")
  , JanusConverter = require("./Converter/Janus.js")
  , SkywayConverter = require("./Converter/Skyway.js")

var SrvConnectors = {
  "janus": JanusConnector,
  "skyway": SkywayConnector
}

var Converters = {
  "janus": JanusConverter,
  "skyway": SkywayConverter
}

///////////////////////////
// class definition

class Gateway {
  constructor(server_name, dst_server /* string or Array of strings */) {
    // todo verify server_name
    this.server_name = server_name;
    if(typeof(dst_server) === "string") {
      this.dst_servers = [dst_server];
    } else {
      // todo: this code assuming that dst_server must string or Array,
      this.dst_servers = dst_server;
    }

    this.srv_connector = new SrvConnectors[server_name]();
    this.orc_connector = new OrchestratorConnector();
    this.converter = new Converters[server_name]();
  }

  init(){
  }

  start() {
    console.log("hello", this.server_name); // just test

    this.connectToServer();
    this.connectToOrchestrator();
  }

  connectToServer(){
    // connect to each signaling server and set the handler when message is received
    this.srv_connector.connect(this.serverHandler);
  }

  connectToOrchestrator(){
    // todo: connect to redis-server and set orchestratorHandler
    this.orc_connector.connect(this.orchestratorHandler);
  }



  serverHandler(mesg) {
    // handle message received from signaling server
    var converted = this.converter.tocgof(mesg);

    // converted.mesg = converted message
    // converted.nextaction = "forward | discard | sendback"
    switch(converted.nextaction) {
    case "forward":
      this.postToOrchestrator(converted.mesg);
      break;
    case "sendback":
      this.postToServer(converted.mesg);
      break;
    case "discard":
      // do nothing.
      break;
    default:
      // todo: logging.
    }
  }

  orchestratorHandler(mesg) {
    var converted = this.converter.toserver(mesg);

    // converted.mesg = converted message
    // converted.nextaction = "forward | discard | sendback"
    switch(converted.nextaction) {
    case "forward":
      this.postToServer(converted.mesg);
      break;
    case "sendback":
      this.postToOrchestrator(converted.mesg);
      break;
    case "discard":
      // do nothing.
      break;
    default:
      // todo: logging.
    }
  }


  postToOrchestrator(mesg) {
    // add src and dest for gateway module
    for(var dst in this.dst_servers) if(this.dst_server.hasOwnProperty(dst)) {
      mesg.src = this.server_name;
      mesg.dst = dst;
    }

    this.orc_connector.send(mesg);
  }

  postToServer(mesg) {
    this.srv_connector.send(mesg);
  }


}

module.exports = Gateway;