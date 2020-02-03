/* Background Script */
import {Action, MediaStatus} from constants;

chrome.runtime.onMessage.addListener(handleContentMessage);
chrome.tabs.onActivated.addListener(handleOnTabActivated);
chrome.tabs.onRemoved.addListener(handleOnTabRemoved);
chrome.webNavigation.onHistoryStateUpdated.addListener(handleOnURLchanged);

let playingTabId;
let focusedTabId;
let setOfTabs = new Set();

chrome.browserAction.setBadgeBackgroundColor({
    color: [47, 47, 47, 255]
});

function handleContentMessage(status, sender) {

    if (status === MediaStatus["played"]) {

        // 1. media started playing in unfocused tab
        if (sender.tab.id !== focusedTabId){
            
            chrome.tabs.sendMessage(sender.tab.id, Action["pause"]);

            if (!setOfTabs.has(sender.tab.id)) {
                setOfTabs.add(sender.tab.id);
                chrome.browserAction.setBadgeText({
                    text: "" + setOfTabs.size
                });
            }
        }
        // 2. media started playing in now focused tab
        else {

            // 2.1 pause if there is another currently playing media
            if(playingTabId !== undefined){
                chrome.tabs.sendMessage(playingTabId, Action["pause"]);
            }
            
            playingTabId = sender.tab.id;

            if (!setOfTabs.has(playingTabId)) {
                setOfTabs.add(playingTabId);
                chrome.browserAction.setBadgeText({
                    text: "" + setOfTabs.size
                });
            }
        }

    } else if (status === MediaStatus["ended"]) {

        // remove the playingTabId if media has ended so that 2.1 will fail if media is replayed again in the same focused tab
        if (sender.tab.id === playingTabId){
            playingTabId = undefined;
        }

        if (setOfTabs.has(sender.tab.id)) {
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

        }
    }
}

function handleOnTabActivated(tab) {

    focusedTabId = tab.tabId;
    // focused tab has known to play media and it is not the currently playing tab
    if (setOfTabs.has(focusedTabId) && focusedTabId !== playingTabId) {
        if (playingTabId !== undefined) {
            chrome.tabs.sendMessage(playingTabId, Action["pause"]);
        }

        // playingTabId set to undefined so that 2.1 will fail if this is the tab we are telling now to play
        // this variable as well as badge text will be updated after 2.1
        playingTabId = undefined;
        chrome.tabs.sendMessage(focusedTabId, Action["play"]);
    }
    
}

function handleOnTabRemoved(tabId) {
    if (setOfTabs.has(tabId)) {
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
}

function handleOnURLchanged(tab) {
    if (setOfTabs.has(tab.tabId)) {
        setOfTabs.delete(tab.tabId);
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
}