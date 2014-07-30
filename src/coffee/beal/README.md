# BEAL: Browser Extension Abstraction Layer

The coffee files in these directories create an abstraction layer between functionality
the extension needs and the different APIs the supported browsers expose.

These files create `module.extension` (or `window.iidentity.extension` if console
access is required).

# */background.coffee

This file is only included in the background page, to ensure that the content script
or options pages cannot wrongly modify any settings.

- storage
    required, a storage object that behaves like the Chrome storage api:
    - get(obj keysAndDefaults, void callback(obj value))
    - set(obj data, void callback())
    The values in data are always JSONifieable
- bool isOptionsPage(string url)
    required, checks whether a given url is this extension's option page
- string getURL(string relative)
    required, gives the URL of an asset given its relative path
- void sendToTabs(obj message)
    required, sends the given message to all tabs with a running content script
    of the extension
- void addMessageListener(bool listener(obj request, obj sender, void sendResponse(obj response)))
    required, registers the given listener
    - request: the object the sender sent
    - sender: an object containing at least:
        - string sender.url: required
        - object sender.tab: optional, if it exists it must contain sender.tab.id
    - sendResponse: a function that takes a single parameter, the object to send back
    The listener function can return true or false (or null/undefined). If true is
    returned, the sendResponse function _may_ be called _after_ the listener returned.
    _The sendResponse function must be called exactly once,_ a `null` message is seen
    as "no reply to give".
- void addDataChangedListener(void listener(arr changes))
    required, though the implementation is allowed to be an empty function
    the listener accepts a single parameter, an array containing the changed data keys
- void init()
    optional, will be called when DOM is ready if the value isn't null/undefined

# */content.coffee

This file is included in all javascript files apart from `background.js`.

- void sendMessage(obj message, void callback(obj reply))
    required, sends the message to the background page, calls callback with
    the reply
- void addMessageListener(void listener(obj request))
    required, registers the given listener, which is passed each message as it arrives
    if it isn't null.
- string getURL(string relative)
    required, gives the URL of an asset given its relative path
- mixed getLastError()
    optional, should be _absent when not implemented_, don't use an empty function!
- void init()
    optional, will be called when DOM is ready if the value isn't null/undefined
