/* iframes Content Script */
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

let imediaList = [];
let icurrentMedia;

try{
    if(isParent){
        console.log("iframe add event listener");
    }
}
catch(e){
    console.log("iframe catch");
    console.log(e);
    window.addEventListener("message", handleParentMessage, false);
}

async function handleParentMessage(e){
    switch (e.data.action) {
        case ACTION.play:

            if(icurrentMedia){
                icurrentMedia.removeEventListener("play", ihandleOnPlay);
                let played = icurrentMedia.play();
                if(played){
                    played.then(()=> icurrentMedia.addEventListener("play", ihandleOnPlay)).catch(e => console.log(e));
                }
            }
            break;

        case ACTION.pause:

            if(icurrentMedia){
                icurrentMedia.removeEventListener("pause", ihandleOnPause);
                icurrentMedia.pause();
                icurrentMedia.addEventListener("pause", ihandleOnPause);
            }
            break;

        case ACTION.reload:

            iforgetMedia();
            iregisterMedia();
            console.log("iframe content reload");
            break;

        case "check_ready_state_complete":

            let complete = e.data.complete;
            if(complete){
                window.parent.postMessage({mediaStatus: "check_site_exclusion"}, "*");
            }
            else {
                setTimeout(()=>{
                    window.parent.postMessage({mediaStatus: "check_ready_state_complete"}, "*");
                }, 1500);
            }
            break;

        case "check_site_exclusion":

            let siteExcluded = e.data.exclusion;
            if(!siteExcluded){
                iregisterMedia();
            }
            console.log("iframe check site exclusion "+siteExcluded);
            break;

        case "site_enabled":

            iregisterMedia();
            break;
    
        case "site_disabled":

            iforgetMedia();
            break;
    }
}

try{
    if(isParent){
        console.log("iframe add ready state change");
    }
}
catch(e){
    console.log("iframe catch");
    console.log(e);

    document.addEventListener('readystatechange', e => {
        if (e.target.readyState === "complete") {
            window.parent.postMessage({mediaStatus: "check_ready_state_complete"}, "*");
        }
    });
}

function iforgetMedia(){

    if(imediaList.length){
        imediaList.forEach(m => {
            m.removeEventListener("play", ihandleOnPlay);
            m.removeEventListener("ended", ihandleOnEnded);
            m.removeEventListener("pause", ihandleOnPause);
        });
    }
    
    icurrentMedia = undefined;
}

async function iregisterMedia(){
    console.log("iframe register media");
    imediaList = document.querySelectorAll("VIDEO", "AUDIO");

    imediaList.forEach(m => {
        m.addEventListener("play", ihandleOnPlay);
        m.addEventListener("ended", ihandleOnEnded);

        // if media is already started playing before handleOnPlay is registered, pause and play to notify main script
        if(m.paused === false){
           m.pause();
           m.play();
        }
        m.addEventListener("pause", ihandleOnPause);
    });
}

function ihandleOnPlay(e){
    // if icurrentMedia exists
    if(icurrentMedia){
        //if icurrentMedia is not the trigering one and is already playing, iframe content script will pause it 
        if(icurrentMedia !== e.target && !icurrentMedia.paused){
            icurrentMedia.removeEventListener("pause", ihandleOnPause);
            icurrentMedia.pause();
            icurrentMedia.addEventListener("pause", ihandleOnPause);
        }
        // user plays the media now which was previously paused
        else if (icurrentMedia === e.target){
            window.parent.postMessage({mediaStatus: MEDIAEVENT.played}, "*");
        }
    //icurrentMedia is not found yet or undefined
    }else {
        window.parent.postMessage({mediaStatus: MEDIAEVENT.played}, "*");
    }
        
    icurrentMedia = e.target;

    console.log("iframe play");
}

function ihandleOnEnded(e){
    if(e.target === icurrentMedia){
        window.parent.postMessage({mediaStatus: MEDIAEVENT.ended}, "*");
        // undefine icurrentMedia to notify background if it replays
        icurrentMedia = undefined;
    }

    console.log("iframe ended");
}

function ihandleOnPause(e){
    if(e.target === icurrentMedia){
        window.parent.postMessage({mediaStatus: MEDIAEVENT.paused}, "*");
    }

    console.log("iframe pause");
}