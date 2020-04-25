/* Content Script */

// these 3 const will come from iframe_content
// const ACTION = {
//     play: 0,
//     pause: 1,
//     reload: 2
// }
// const MEDIAEVENT = {
//     played: 0,
//     ended: 1,
//     paused: 2
// }
// const debug = false;

const isParent = true;

let enabled = false;
let mediaList= [];
let currentMedia;
let currentURL;
let userPaused = false;
let siteExcluded = false;
// let iframeSet = new Set();
let currentIframe;
let iframeRefs = new Set();

chrome.runtime.onMessage.addListener(async message => {
    switch (message.action) {
        case ACTION.play:

            if(currentMedia){
                // play only if user did not pause
                if(!userPaused){
                    currentMedia.removeEventListener("play", handleOnPlay);
                    let played = currentMedia.play();
                    if(played){
                        played.then(()=> {
                            currentMedia.addEventListener("play", handleOnPlay);
                            if(debug){
                                console.log("Background :: ACTION.play");
                            }
                        })
                        .catch(e => {
                            if(debug){
                                console.log(e);
                            }
                        });
                    }
                }
            }
            else if(currentIframe){
                // play only if user did not pause
                if(!userPaused){
                    currentIframe.postMessage({action: ACTION.play}, "*");
                }
            }
            break;

        case ACTION.pause:

            if(currentMedia){
                currentMedia.removeEventListener("pause", handleOnPause);
                currentMedia.pause();
                currentMedia.addEventListener("pause", handleOnPause);
                if(debug){
                    console.log("Background :: ACTION.pause");
                }
            }
            else if(currentIframe){
                currentIframe.postMessage({action: ACTION.pause}, "*");
            }
            break;

        case ACTION.reload:

            if(message.url !== currentURL || currentURL === undefined){
                currentURL = message.url;
                forgetMedia();
                setTimeout(()=>{
                    registerMedia();
                    if(mediaList.length===0){
                        // give another chance for slow internet
                        setTimeout(registerMedia, 4000);
                        if(debug){
                            console.log("Background :: ACTION.reload :: Second attempt");
                        }
                    }
                    if(debug){
                        console.log("Background :: ACTION.reload");
                    }
                }, 3000);
                for(iframe of iframeRefs.values()){
                    iframe.postMessage({action: ACTION.reload}, "*");
                }
                iframeRefs.clear();
            }
            break;

        case "am_i_focused":

            userPaused = message.focused;
            if(debug){
                console.log("Background :: am_i_focused :: userPaused "+userPaused);
            }
            break;

        case "continue_handle_on_tab_activated":

            // to check by background if media in this tab was paused by user
            // to either pause the media in the unfocused tab (playingTabId) or not
            chrome.runtime.sendMessage({mediaStatus: "continue_handle_on_tab_activated", userPaused: userPaused});
            if(debug){
                console.log("Background :: continue_handle_on_tab_activated :: userPaused "+userPaused);
            }
            break;

        case "check_site_exclusion":

            siteExcluded = message.exclusion;
            if(!siteExcluded){
                registerMedia();
                enabled = true;
            }
            if(debug){
                console.log("Background :: check_site_exclusion :: siteExcluded "+siteExcluded);
            }
            break;

        case "site_enabled":

            enabled = true;
            registerMedia();
            for(iframe of iframeRefs.values()){
                iframe.postMessage({action: "site_enabled"}, "*");
            }
            if(debug){
                console.log("Background :: site_enabled");
            }
            break;

        case "site_disabled":

            enabled = false;

            for(iframe of iframeRefs.values()){
                iframe.postMessage({action: "site_disabled"}, "*");
            }

            if(currentMedia || currentIframe){
                chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.ended});
            }

            forgetMedia();
            if(debug){
                console.log("Background :: site_disabled");
            }
            break;
    }
});

// document.addEventListener('readystatechange', e => {
//     if (e.target.readyState === "complete") {
//         // check with background if this site is excluded
//         chrome.runtime.sendMessage({mediaStatus: "check_site_exclusion"});
//     }
// });

window.addEventListener('load', function onWindowLoad(){
    // check with background if this site is excluded
    chrome.runtime.sendMessage({mediaStatus: "check_site_exclusion"});
    window.removeEventListener('load', onWindowLoad);
});

function forgetMedia(){

    if(mediaList.length){
        mediaList.forEach(m => {
            m.removeEventListener("play", handleOnPlay);
            m.removeEventListener("ended", handleOnEnded);
            m.removeEventListener("pause", handleOnPause);
        });
    }
    
    currentMedia = undefined;
    currentIframe = undefined;

    mediaList= [];
}

async function registerMedia(){
    mediaList = document.querySelectorAll("VIDEO", "AUDIO");
    if(debug){
        console.log("Main :: Media elements "+mediaList.length);
    }
    mediaList.forEach(m => {
        m.addEventListener("play", handleOnPlay);
        m.addEventListener("ended", handleOnEnded);

        // if media is already started playing before handleOnPlay is registered, pause and play to notify background
        if(m.paused === false){
            m.pause();
            m.play();
        }
        m.addEventListener("pause", handleOnPause);
    });
}

function handleOnPlay(e){
    // if currentMedia exists
    if(debug){
        console.log("Main :: currentMedia ::");
        console.log(currentMedia);
    }
    
    if(currentMedia){
        //if currentMedia is not the trigering one and is already playing, content script will pause it 
        if(currentMedia !== e.target && !currentMedia.paused){
            currentMedia.removeEventListener("pause", handleOnPause);
            currentMedia.pause();
            currentMedia.addEventListener("pause", handleOnPause);
        }
        // user plays the media now which was previously paused
        else if (currentMedia === e.target && userPaused){
            chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.played});  
        }
    }

    if(currentIframe){
        currentIframe.postMessage({action: ACTION.pause}, "*");
        currentIframe = undefined;
    }

    // both currentMedia and currentIframe are not found yet or undefined; send message to background to register this tab
    if(!currentMedia && !currentIframe) {
        chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.played});    
    }
        
    currentMedia = e.target;

    // reset the userPaused
    userPaused = false;
}

function handleOnEnded(e){
    if(e.target === currentMedia){
        chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.ended});
        // undefine both to notify background if one of them replays
        currentMedia = undefined;
        currentIframe = undefined;
    }
}

function handleOnPause(e){
    
    // distinguish between user and background pause action; if tab is focused then user is pausing
    // if user pauses, then this media should not be played by background when user navigates back to this tab
    // e.target must be currentMedia to exclude other media paused by content in this very tab
    if(e.target === currentMedia){
        // background will send the message back, parameter in callback always come as undefined so have to do this way
        chrome.runtime.sendMessage({mediaStatus: "am_i_focused"});
    }
}

window.addEventListener("message", handleIframeMessage, false);

function handleIframeMessage(e){

    // iframeRefs is a set
    iframeRefs.add(e.source);

    switch (e.data.mediaStatus) {
        case MEDIAEVENT.played:
            
            // if current media is already there, do not send message to background
            if(currentMedia){
                if(!currentMedia.paused){
                    // removing pause listener; we don't want to send this to background; user didn't pause
                    currentMedia.removeEventListener("pause", handleOnPause);
                    currentMedia.pause();
                    currentMedia.addEventListener("pause", handleOnPause);
                }

                currentMedia = undefined;
            }
            // if current iframe is already there, do not send message to background
            else if(currentIframe){
                if(currentIframe !== e.source){
                    currentIframe.postMessage({action: ACTION.pause}, "*");
                }
            }
            // current media and current iframe doesn't exist yet, send message to background to register this tab
            else {
                chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.played});
            }

            currentIframe = e.source;
            break;

        case MEDIAEVENT.paused:

            chrome.runtime.sendMessage({mediaStatus: "am_i_focused"});
            break;

        case MEDIAEVENT.ended:

            if(currentIframe === e.source){
                chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.ended});
                // undefine both to notify background if one of them replays
                currentMedia = undefined;
                currentIframe = undefined;
            }
            break;

        case "check_ready_state_complete":

            if(document.readyState === "complete"){
                e.source.postMessage({action: "check_ready_state_complete", complete: true}, "*");
            }
            else {
                e.source.postMessage({action: "check_ready_state_complete", complete: false}, "*");
            }
            break;

        case "check_site_exclusion":

            e.source.postMessage({action: "check_site_exclusion", exclusion: !enabled}, "*");
            break;
            
    }
}