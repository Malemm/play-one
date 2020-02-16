/* Background Script */
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

chrome.runtime.onMessage.addListener(handleContentMessage);
chrome.tabs.onActivated.addListener(handleOnTabActivated);
chrome.tabs.onRemoved.addListener(handleOnTabRemoved);
chrome.webNavigation.onHistoryStateUpdated.addListener(handleOnURLchanged);
chrome.browserAction.onClicked.addListener(toggleExclusion);

let playingTabId;
let focusedTabId;
let setOfTabs = new Set();
let exclusionSet = new Set();

chrome.browserAction.setBadgeBackgroundColor({
    color: [47, 47, 47, 255]
});

function handleContentMessage(status, sender) {

    if (status.mediaStatus === MEDIAEVENT.played) {

        console.log("playingTabId "+playingTabId);
        // 1. media started playing in unfocused tab
        if (sender.tab.id !== focusedTabId){
            
            chrome.tabs.sendMessage(sender.tab.id, {action: ACTION.pause});

            setOfTabs.add(sender.tab.id);
            chrome.browserAction.setBadgeText({
                text: "" + setOfTabs.size
            });
        }
        // 2. media started playing in now focused tab
        else {

            // 2.1 pause if there is an already playing media in another tab
            if(sender.tab.id !== playingTabId && playingTabId !== undefined){
                chrome.tabs.sendMessage(playingTabId, {action: ACTION.pause});
            }
            console.log("1 playing tab id: "+playingTabId);
            playingTabId = sender.tab.id;
            console.log("2 playing tab id: "+playingTabId);

            setOfTabs.add(playingTabId);
            chrome.browserAction.setBadgeText({
                text: "" + setOfTabs.size
            });
        }

    } else if (status.mediaStatus === MEDIAEVENT.ended) {

        // remove the playingTabId if media has ended so that 2.1 will fail if media is replayed again in the same focused tab
        if (sender.tab.id === playingTabId){
            playingTabId = undefined;
        }

        setOfTabs.delete(sender.tab.id);
        if(setOfTabs.size>0){
            chrome.browserAction.setBadgeText({
                text: "" + setOfTabs.size
            });
        }else {
            chrome.browserAction.setBadgeText({
                text: ""
            });
        }

    } else if (status.mediaStatus === "am_i_focused") {

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            let focused = false;
            if(tabs !== undefined){
                if(tabs[0].id === sender.tab.id) {
                    focused = true;
                }
            }
            chrome.tabs.sendMessage(sender.tab.id, {action: "am_i_focused", focused: focused});
        });

    } else if (status.mediaStatus === "continue_handle_on_tab_activated"){
        // skip if focused tab is immediately changed before getting the userPaused response
        if(sender.tab.id === focusedTabId){
            // if focused tab has known to play media AND it is not the currently playing tab AND it was not paused by user
            if (setOfTabs.has(focusedTabId) && focusedTabId !== playingTabId && !status.userPaused) {
                if (playingTabId !== undefined) {
                    chrome.tabs.sendMessage(playingTabId, {action: ACTION.pause});
                    // console.log("sending pause");
                }
        
                // playingTabId is now focusedTabId; 2.1 should not execute on played message from content script because of the consequence of below play message
                playingTabId = focusedTabId;
                chrome.tabs.sendMessage(playingTabId, {action: ACTION.play});
            }
        }
    } else if (status.mediaStatus === "check_site_exclusion"){
        console.log(sender.tab.url);
        let site = getSite(sender.tab.url);
        console.log(site);
        let excluded = false;
        if (exclusionSet.has(site)){
            excluded = true;
        }
        chrome.tabs.sendMessage(sender.tab.id, {action: "check_site_exclusion", exclusion: excluded});
    }
}


function handleOnTabActivated(tab) {

    focusedTabId = tab.tabId;
    // // if focused tab has known to play media and it is not the currently playing tab
    // if (setOfTabs.has(focusedTabId) && focusedTabId !== playingTabId) {
    //     if (playingTabId !== undefined) {
    //         chrome.tabs.sendMessage(playingTabId, {action: ACTION.pause});
    //         // console.log("sending pause");
    //     }

    //     // playingTabId is now focusedTabId; 2.1 should not execute on played message from content script because of the consequence of below play message
    //     playingTabId = focusedTabId;
    //     chrome.tabs.sendMessage(playingTabId, {action: ACTION.play});
    // }

    // for playing the media
    if(setOfTabs.has(focusedTabId)){
        chrome.tabs.sendMessage(focusedTabId, {action: "continue_handle_on_tab_activated"});
    }

    // for updating the icon with corresponding enabled or disabled status on the site
    chrome.tabs.get(tab.tabId, function(tab){
        let site = getSite(tab.url);
        if(exclusionSet.has(site)){
            chrome.browserAction.setIcon({path : {"48": "images/icon_48_inactive.png"}});
        }
        else {
            chrome.browserAction.setIcon({path : {"48": "images/icon_48.png"}});
        }
    });
    
}

function handleOnTabRemoved(tabId) {
    forgetTab(tabId);
}

function handleOnURLchanged(tab) {
    let site = getSite(tab.url);
    // tell content to reload media only if the site is not excluded
    if(!exclusionSet.has(site)){
        chrome.tabs.sendMessage(tab.tabId, {action: ACTION.reload, url: tab.url});
        forgetTab(tab.tabId);
        console.log("url updated "+tab.url+" "+tab.transitionType);
    }
}

function forgetTab(tabId){
    if(tabId === playingTabId){
        playingTabId = undefined;
    }
    setOfTabs.delete(tabId);
    if(setOfTabs.size>0){
        chrome.browserAction.setBadgeText({
            text: "" + setOfTabs.size
        });
    }else {
        chrome.browserAction.setBadgeText({
            text: ""
        });
    }
}

function toggleExclusion(tab){
    let site = getSite(tab.url);
    if(exclusionSet.has(site)){
        exclusionSet.delete(site);
        chrome.browserAction.setIcon({path : {"48": "images/icon_48.png"}});
    }
    else {
        exclusionSet.add(site);
        chrome.browserAction.setIcon({path : {"48": "images/icon_48_inactive.png"}});
    }

    // update the exclusion list
    let updatedlist = [...exclusionSet];
    chrome.storage.sync.set({play1ExcludedSites: updatedlist}, getExclusionSet);

}


function getSite (a) {
    let b = a.indexOf("//") + 2;
    let c = a.indexOf("/", b);
    return 0 < c ? a.substring(b, c) : ((c = a.indexOf("?", b)), 0 < c ? a.substring(b, c) : a.substring(b));
}

function getExclusionSet(){
    chrome.storage.sync.get({play1ExcludedSites: []}, function(data){
        let excludedSites = data.play1ExcludedSites || [];
        exclusionSet = new Set(excludedSites);
    });
    console.log(exclusionSet);
}

getExclusionSet();