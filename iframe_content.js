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

let imediaList;
let icurrentMedia;

try{
    if(!isParent){
        window.addEventListener("message", handleParentMessage, false);
        console.log("handle parent message");
    }
}
catch(e){
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
            break;
    }
}

try{
    if(!isParent){
        document.addEventListener('readystatechange', e => {
            if (e.target.readyState === "complete") {
                iregisterMedia();
            }
        });
        console.log("this should not run");
    }
}
catch(e){
}


async function iregisterMedia(){
    console.log("iframe register media");
    imediaList = document.querySelectorAll("VIDEO", "AUDIO");

    imediaList.forEach(m => {
        m.addEventListener("play", ihandleOnPlay);
        m.addEventListener("ended", ihandleOnEnded);

        let notAdded = true;
        
        // register video in the background
        // readyState 4 = HAVE_ENOUGH_DATA - enough data available to start playing
        if(m.paused === true && m.readyState === 4){
            let played =  m.play();
            if(played){
                played.then(()=> m.pause())
                .then(() => {
                    m.addEventListener("pause", ihandleOnPause);
                    notAdded = false;
                })
                .catch(e => console.log(e));
            }
        }
        else if (m.paused ===  false){
            m.pause();
            m.play();
        }

        if(notAdded){
            m.addEventListener("pause", ihandleOnPause);
        }
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