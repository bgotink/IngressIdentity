/*
 * Makes any file within the data directory available to use in an iframe.
 * Replace this: require("sdk/self").data.url(...)
 * With this: require("name-of-this-file").url(...)
 */

var { Class } = require('sdk/core/heritage');
var { Unknown, Factory } = require('sdk/platform/xpcom');
var { Cc, Ci, Cr } = require('chrome');
var self = require("sdk/self");

var resourceProtocolHandler = Cc["@mozilla.org/network/io-service;1"]
  .getService(Ci.nsIIOService)
  .getProtocolHandler('resource');

var scheme = "res-" + self.id.toLowerCase().replace(/[^a-z0-9+\-\.]/g, "-");

var AddonProtocolHandler = Class({
  extends: Unknown,
  interfaces: ['nsIProtocolHandler'],

  scheme: scheme,
  defaultPort: -1,
  protocolFlags: Ci.nsIProtocolHandler.URI_STD
    | Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE
    | Ci.nsIProtocolHandler.URI_SAFE_TO_LOAD_IN_SECURE_CONTEXT,

  newURI: function(spec, originCharset, baseURI) {
    let uri = Cc["@mozilla.org/network/standard-url;1"].createInstance(Ci.nsIStandardURL);
    uri.init(uri.URLTYPE_STANDARD, this.defaultPort, spec, originCharset, baseURI);
    return uri.QueryInterface(Ci.nsIURI);
  },

  newChannel: function(uri) {
    if (uri.spec.indexOf(exports.url("")) != 0) {
      throw Cr.NS_ERROR_ILLEGAL_VALUE;
    }
    var resourceUri = resourceProtocolHandler.newURI(uri.spec.replace(scheme + "://", "resource://"), uri.originCharset, null);
    var channel = resourceProtocolHandler.newChannel(resourceUri);
    channel.originalURI = uri;
    return channel;
  },

  allowPort: (port, scheme) => false
});

Factory({
  contract: "@mozilla.org/network/protocol;1?name=" + scheme,
  Component: AddonProtocolHandler
});

exports.url = function(url) {
  return self.data.url(url).replace("resource://", scheme + "://");
};
