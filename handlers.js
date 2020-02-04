const ACTION = {
    play : 0,
    pause : 1
}

const MEDIASTATUS = {
    played : 0,
    ended : 1
}

const PLAY1EVENT2CONTENT = 'playOneEvent_toContent';
const PLAY1EVENT2PAGE = 'playOneEvent_toPage';

// this variable will have the media object only if it is playing at any point of time
let currentRunningMedia;

document.addEventListener("play", handleOnPlayInDocument);
document.addEventListener("ended", handleOnEndedInDocument);
document.addEventListener(PLAY1EVENT2PAGE, handlePlayOneContentEvent);

console.log("hello");

function handleOnPlayInDocument(e){

    console.log(e.nodeName);
    console.log(e.nodeName === "VIDEO" || e.nodeName === "AUDIO");
    if(e.nodeName === "VIDEO" || e.nodeName === "AUDIO"){

        // if currentRunningMedia exists
        if(currentRunningMedia !== undefined){
            //currentRunningMedia is another media object and is already playing, content script will pause it 
            if(currentRunningMedia !== e.target && currentRunningMedia.paused === false){
                currentRunningMedia.pause();
            }
        
        //currentRunningMedia is not found yet or undefined, raise event to content script to send message to background script
        }else {
            document.dispatchEvent(new CustomEvent(PLAY1EVENT2CONTENT, {mediaStatus: MEDIASTATUS.played}));     
        }
        
        currentRunningMedia = e.target;
    }

}

function handleOnEndedInDocument(e){

    if(e.nodeName === "VIDEO" || e.nodeName === "AUDIO"){
        //undefine currentRunningMedia and raise event to content script to send message to background script
        if(e.target === currentRunningMedia){
            currentRunningMedia = undefined;    
            document.dispatchEvent(new CustomEvent(PLAY1EVENT2CONTENT, {mediaStatus: MEDIASTATUS.ended}));
        }
    }
}

function handlePlayOneContentEvent(e){
    if(currentRunningMedia !== undefined){
        if(e.mediaAction === ACTION.play){
            currentRunningMedia.play();
        }
        else if(e.mediaAction === ACTION.pause){
            currentRunningMedia.pause();
            currentRunningMedia = undefined;
        }
    }
}