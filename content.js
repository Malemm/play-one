/* Content Script */
const ACTION = {
    play: 0,
    pause: 1,
    reload: 2
}
const MEDIASTATUS = {
    played: 0,
    ended: 1
}
const LIGHTMODE = 0;
const FULLMODE = 1;
let mode = FULLMODE;
let mediaList;
let currentMedia;
let currentURL;

if(mode){
    console.log("Play-One | Running Full Mode")
}
else{
    console.log("Play-One | Running Light Mode")
}

chrome.runtime.onMessage.addListener((message) => {
    if(message.action === ACTION.play && currentMedia !== undefined){
        currentMedia.play();
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
});

document.addEventListener('readystatechange', e => {
    if (e.target.readyState === "complete") {
        registerMedia();
    }
});

function reloadContent(){

    if(mode === FULLMODE){
        console.log("reload media elements: "+mediaList.length)
        mediaList.forEach(m => {
            m.removeEventListener("play", handleOnPlayFull);
            m.removeEventListener("play", handleOnEndedFull);
        });

        currentMedia = undefined;
    }
    else {
        if(currentMedia !== undefined){
            currentMedia.removeEventListener("play", handlePlayLight);
            currentMedia.removeEventListener("ended", handleEndedLight);
            currentMedia = undefined;
        }
    }

    registerMedia();

    console.log("content reloaded on url update");
}

function registerMedia(){
    switch (mode){
        case LIGHTMODE:
            currentMedia = document.querySelector("VIDEO");
            if(currentMedia !== undefined || currentMedia !== null){
                currentMedia.addEventListener("play", handlePlayLight);
                currentMedia.addEventListener("ended", handleEndedLight);
            }

            break;
        
        case FULLMODE:
            mediaList = document.querySelectorAll("VIDEO", "AUDIO");
            console.log("media elements: "+mediaList.length)
            mediaList.forEach(m => {
                m.addEventListener("play", handleOnPlayFull);
                m.addEventListener("ended", handleOnEndedFull);
            });

            break;
    }
}

function handlePlayLight(){
    chrome.runtime.sendMessage(MEDIASTATUS.played);
}

function handleEndedLight(){
    chrome.runtime.sendMessage(MEDIASTATUS.ended);
}

function handleOnPlayFull(e){
    // if currentMedia exists
    console.log("currentMedia");
    console.log(currentMedia);
    if(currentMedia !== undefined){
        //if currentMedia is not the trigering one and is already playing, content script will pause it 
        if(currentMedia !== e.target && currentMedia.paused === false){
            currentMedia.pause();
        }
    //currentMedia is not found yet or undefined
    }else {
        chrome.runtime.sendMessage(MEDIASTATUS.played);    
    }
        
    currentMedia = e.target;
}

function handleOnEndedFull(e){
    if(e.target === currentMedia){
        chrome.runtime.sendMessage(MEDIASTATUS.ended);
        // undefine currentMedia to notify background if it replays
        currentMedia = undefined;
    }
}