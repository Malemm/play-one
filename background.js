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
chrome.webNavigation.onCompleted.addListener(handleOnCompleted);

let playingTabId;
let focusedTabId;
let setOfTabs = new Set();
let exclusionSet = new Set();
let doubleClickPressedOnce = false;

const titleText = "Play-One  [Plays only one video/audio at a time]";

function handleContentMessage(status, sender) {

    let site;

    switch(status.mediaStatus){
        case MEDIAEVENT.played:

            console.log("playingTabId "+playingTabId);
            // 1. media started playing in unfocused tab
            if (sender.tab.id !== focusedTabId){
                
                chrome.tabs.sendMessage(sender.tab.id, {action: ACTION.pause});
    
                setOfTabs.add(sender.tab.id);
            }
            // 2. media started playing in now focused tab
            else {
    
                // 2.1 pause if there is an already playing media in another tab
                if(sender.tab.id !== playingTabId && playingTabId){
                    chrome.tabs.sendMessage(playingTabId, {action: ACTION.pause});
                }
                console.log("1 playing tab id: "+playingTabId);
                playingTabId = sender.tab.id;
                console.log("2 playing tab id: "+playingTabId);
    
                setOfTabs.add(playingTabId);
                site = getSite(sender.url)
                updateIconTextOnEnabledSiteWithMedia(site);
            }
            break;

        case MEDIAEVENT.ended:

            // remove the playingTabId if media has ended so that 2.1 will fail if media is replayed again in the same focused tab
            if (sender.tab.id === playingTabId){
                playingTabId = undefined;
            }

            setOfTabs.delete(sender.tab.id);

            site = getSite(sender.url);
            updateIconTextOnEnabledSiteWithNoMedia(site);
            break;

        case "am_i_focused":
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                let focused = false;
                if(tabs){
                    if(tabs[0].id === sender.tab.id) {
                        focused = true;
                    }
                }
                chrome.tabs.sendMessage(sender.tab.id, {action: "am_i_focused", focused: focused});
            });
            break;

        case "continue_handle_on_tab_activated":

            // skip if focused tab is immediately changed before getting the userPaused response
            if(sender.tab.id === focusedTabId){
                // if focused tab has known to play media AND it is not the currently playing tab AND it was not paused by user
                if (setOfTabs.has(focusedTabId) && focusedTabId !== playingTabId && !status.userPaused) {
                    if (playingTabId) {
                        chrome.tabs.sendMessage(playingTabId, {action: ACTION.pause});
                        // console.log("sending pause");
                    }
            
                    // playingTabId is now focusedTabId; 2.1 should not execute on played message from content script because of the consequence of below play message
                    playingTabId = focusedTabId;
                    chrome.tabs.sendMessage(playingTabId, {action: ACTION.play});
                }
            }
            break;

        case "check_site_exclusion":

            console.log(sender.tab.url);
            site = getSite(sender.tab.url);
            console.log(site);
            let excluded = false;
            if (exclusionSet.has(site)){
                excluded = true;
            }
            chrome.tabs.sendMessage(sender.tab.id, {action: "check_site_exclusion", exclusion: excluded});
            break;

    }
}

function handleOnTabActivated(tab) {

    focusedTabId = tab.tabId;

    // for playing the media
    if(setOfTabs.has(focusedTabId)){
        chrome.tabs.sendMessage(focusedTabId, {action: "continue_handle_on_tab_activated"});
    }

    // for updating the icon with corresponding enabled or disabled status on the site
    chrome.tabs.get(tab.tabId, function(tab){
        let site = getSite(tab.url);
        if(exclusionSet.has(site)){
            updateIconTextOnDisabledSite(site);
        }
        else {
            if(setOfTabs.has(tab.id)){
                updateIconTextOnEnabledSiteWithMedia(site);
            }
            else {
                updateIconTextOnEnabledSiteWithNoMedia(site);
            }
        }
    });
    
}

function handleOnTabRemoved(tabId) {
    forgetTab(tabId);
}

function handleOnURLchanged(tab) {

    if(tab.transitionType !== "auto_subframe"){

        let site = getSite(tab.url);
        // tell content to reload media only if the site is not excluded
        if(!exclusionSet.has(site)){
            chrome.tabs.sendMessage(tab.tabId, {action: ACTION.reload, url: tab.url});
            forgetTab(tab.tabId);
            console.log("url updated "+tab.url+" "+tab.transitionType);
    
            if(setOfTabs.has(tab.id)){
                updateIconTextOnEnabledSiteWithMedia(site);
            }
            else {
                updateIconTextOnEnabledSiteWithNoMedia(site);
            }
        }
        else {
            updateIconTextOnDisabledSite(site);
        }

    }
}

function handleOnCompleted(tab){
    let site = getSite(tab.url);
    if(!exclusionSet.has(site)){
        if(setOfTabs.has(tab.id)){
            updateIconTextOnEnabledSiteWithMedia(site);
        }
        else {
            updateIconTextOnEnabledSiteWithNoMedia(site);
        }
    }
    else {
        updateIconTextOnDisabledSite(site);
    }
}

function forgetTab(tabId){
    if(tabId === playingTabId){
        playingTabId = undefined;
    }
    setOfTabs.delete(tabId);
}

function toggleExclusion(tab){

    if(doubleClickPressedOnce){
        includeOrExcludeSite(tab.url, tab.id);
    }

    doubleClickPressedOnce = true;

    setTimeout(()=>{doubleClickPressedOnce = false}, 1000);
}

function includeOrExcludeSite(url, tabId){
    let site = getSite(url);
    if(exclusionSet.has(site)){
        exclusionSet.delete(site);
        if(setOfTabs.has(tabId)){
            updateIconTextOnEnabledSiteWithMedia(site);
        }
        else {
            updateIconTextOnEnabledSiteWithNoMedia(site);
        }
        chrome.tabs.sendMessage(tabId, {action: "site_enabled"});
    }
    else {
        exclusionSet.add(site);
        updateIconTextOnDisabledSite(site);
        chrome.tabs.sendMessage(tabId, {action: "site_disabled"});
    }

    // update the exclusion list
    let updatedlist = [...exclusionSet];
    chrome.storage.sync.set({play1ExcludedSites: updatedlist});
}

function updateIconTextOnEnabledSiteWithNoMedia(url){
    chrome.browserAction.setIcon({path : {"48": "images/icon_48_active_no_media.png"}});
    chrome.browserAction.setTitle({title: titleText+"\nDouble click to disable on "+url});
}

function updateIconTextOnEnabledSiteWithMedia(url){
    chrome.browserAction.setIcon({path : {"48": "images/icon_48_active_media.png"}});
    chrome.browserAction.setTitle({title: titleText+"\nDouble click to disable on "+url});
}

function updateIconTextOnDisabledSite(url){
    chrome.browserAction.setIcon({path : {"48": "images/icon_48_inactive.png"}});
    chrome.browserAction.setTitle({title: titleText+"\nDouble click to enable on "+url});
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