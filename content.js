/* Content Script */
const ACTION = {
    play: 0,
    pause: 1,
    reload: 2
}
const MEDIAEVENT = {
    played: 0,
    ended: 1,
    paused: 2
}
const LIGHTMODE = 0;
const FULLMODE = 1;
let mode = FULLMODE;
let mediaList;
let currentMedia;
let currentURL;
let userPaused = false;

if(mode){
    console.log("Play-One | Running Full Mode")
}
else{
    console.log("Play-One | Running Light Mode")
}

chrome.runtime.onMessage.addListener((message) => {
    if(message.action === ACTION.play && currentMedia !== undefined){
        // play only if user did not pause
        if(!userPaused){
            currentMedia.play();
        }
        console.log("action play userPaused: "+userPaused);
    }
    else if(message.action === ACTION.pause && currentMedia !== undefined){
        currentMedia.pause();
    }
    else if(message.action === ACTION.reload){
        if(message.url !== currentURL || currentURL === undefined){
            currentURL = message.url;
            reloadContent();
        }
    }
    else if(message.action === "am_i_focused"){
        userPaused = message.focused;
        console.log("action am_i_focused userPaused: "+userPaused);
    }
    // to check by background if media in this tab was paused by user
    // to either pause the media in the unfocused tab (playingTabId) or not
    else if(message.action === "continue_handle_on_tab_activated"){
        chrome.runtime.sendMessage({mediaStatus: "continue_handle_on_tab_activated", userPaused: userPaused});
        console.log("action continue_handle_on_tab_activated userPaused: "+userPaused);
    }
});

document.addEventListener('readystatechange', e => {
    if (e.target.readyState === "complete") {
        registerMedia();
    }
});

function reloadContent(){

    if(mode === FULLMODE){
        mediaList.forEach(m => {
            m.removeEventListener("play", handleOnPlayFull);
            m.removeEventListener("play", handleOnEndedFull);
            m.removeEventListener("pause", handleOnPause);
        });

        currentMedia = undefined;
    }
    else {
        if(currentMedia !== undefined){
            currentMedia.removeEventListener("play", handleOnPlayLight);
            currentMedia.removeEventListener("ended", handleOnEndedLight);
            currentMedia.removeEventListener("pause", handleOnPause);
            currentMedia = undefined;
        }
    }

    registerMedia();

    // console.log("action reload content on url update");
}

function registerMedia(){
    switch (mode){
        case LIGHTMODE:
            currentMedia = document.querySelector("VIDEO");
            if(currentMedia !== undefined || currentMedia !== null){
                currentMedia.addEventListener("play", handleOnPlayLight);
                currentMedia.addEventListener("ended", handleOnEndedLight);
            
                // register video in the background
                // readyState 4 = HAVE_ENOUGH_DATA - enough data available to start playing
                if(currentMedia.paused === true && currentMedia.readyState === 4){
                    currentMedia.play();
                    currentMedia.pause();
                }
                else if (currentMedia.paused ===  false){
                    currentMedia.pause();
                    currentMedia.play();
                }

                currentMedia.addEventListener("pause", handleOnPause);

            }

            break;
        
        case FULLMODE:
            mediaList = document.querySelectorAll("VIDEO", "AUDIO");
            // console.log("media elements found: "+mediaList.length)
            mediaList.forEach(m => {
                m.addEventListener("play", handleOnPlayFull);
                m.addEventListener("ended", handleOnEndedFull);

                // register video in the background
                // readyState 4 = HAVE_ENOUGH_DATA - enough data available to start playing
                if(m.paused === true && m.readyState === 4){
                    m.play();
                    m.pause();
                }
                else if (m.paused ===  false){
                    m.pause();
                    m.play();
                }

                m.addEventListener("pause", handleOnPause);
            });

            break;
    }
}

function handleOnPlayLight(){
    chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.played});
    userPaused = false;
}

function handleOnEndedLight(){
    chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.ended});
}

function handleOnPlayFull(e){
    // if currentMedia exists
    // console.log("currentMedia");
    // console.log(currentMedia);
    if(currentMedia !== undefined){
        //if currentMedia is not the trigering one and is already playing, content script will pause it 
        if(currentMedia !== e.target && currentMedia.paused === false){
            currentMedia.pause();
        }
        // user plays the media now which was previously paused
        else if (currentMedia === e.target && userPaused){
            chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.played});  
        }
    //currentMedia is not found yet or undefined
    }else {
        chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.played});    
    }
        
    currentMedia = e.target;
    userPaused = false;
}

function handleOnEndedFull(e){
    if(e.target === currentMedia){
        chrome.runtime.sendMessage({mediaStatus: MEDIAEVENT.ended});
        // undefine currentMedia to notify background if it replays
        currentMedia = undefined;
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