/* Content Script */
import {Action, MediaStatus} from constants;

// store currently playing media object in the current tab
let currentRunningMedia;

document.addEventListener("play", handleOnPlay);
document.addEventListener("ended", handleOnEnded);
chrome.runtime.onMessage.addListener(handleBackgroundMessage);

function handleBackgroundMessage(action){
    if(action === Action.play){
        if(currentRunningMedia !== undefined){
            currentRunningMedia.play();
        }

    }else if(action === Action.pause){
        if(currentRunningMedia !== undefined){
            currentRunningMedia.pause();
        }
    }
}

function handleOnPlay(e){
    if(e.nodeName === "VIDEO" || e.nodeName === "AUDIO"){

        // if currentRunningMedia exists
        if(currentRunningMedia !== undefined){

            //currentRunningMedia is another media object and is playing, content script will pause it 
            if(currentRunningMedia !== e.target && currentRunningMedia.paused === false){
                currentRunningMedia.pause();

            }

        //currentRunningMedia in this tab is not found, send message to background
        }else {
            chrome.runtime.sendMessage(MediaStatus["played"]);
            
        }

        currentRunningMedia = e.target;
        
    }

}

function handleOnEnded(e){
    if(e.nodeName === "VIDEO" || e.nodeName === "AUDIO"){
        if(e.target === currentRunningMedia){
            currentRunningMedia = undefined;
            chrome.runtime.sendMessage(MediaStatus["ended"]);
        }

    }

}
