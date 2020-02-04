/* Content Script 
This injects handler methods to document DOM and serves only as mediator between those handlers and background script.
*/

/*******************************************************************/
// insert the content of handlers.js to the page DOM
// handlers.js contains event handlers of media onplay and onended
let h = document.createElement('script');
h.src = chrome.runtime.getURL('handlers.js');
h.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(h);
/*******************************************************************/

const ACTION = {
    play : 0,
    pause : 1
}

const MEDIASTATUS = {
    played :0,
    ended :1
}

const PLAY1EVENT2CONTENT = 'playOneEvent_toContent';
const PLAY1EVENT2PAGE = 'playOneEvent_toPage';

document.addEventListener(PLAY1EVENT2CONTENT, handlePlayOnePageEvent);
chrome.runtime.onMessage.addListener(handleBackgroundMessage);

function handlePlayOnePageEvent(e){
    // send media status directly to background script
    let mediaStatus = e.mediaStatus;
    chrome.runtime.sendMessage(mediaStatus);
}

function handleBackgroundMessage(action){
    // send action directly to page handler
    document.dispatchEvent(new CustomEvent(PLAY1EVENT2PAGE, {mediaAction: action}));
}


