'use strict';

document.addEventListener('DOMContentLoaded', function () {
    let site = getSite(document.URL);
    document.getElementById("exclude").innerHTML = "Exclude "+site; 
    let modeCheckbox = document.getElementById("mode_option");
    let exclusionCheckbox = document.getElementById("exclude_option");
    modeCheckbox.addEventListener('change', onModeCheckboxChange());
    exclusionCheckbox.addEventListener('change', OnExclusionCheckboxChange());
    console.log("hello popup");

    chrome.browserAction.setBadgeText({
        text: site.substring(0,4)
    });

});

function getSite (a) {
    let b = a.indexOf("//") + 2;
    let c = a.indexOf("/", b);
    return 0 < c ? a.substring(b, c) : ((c = a.indexOf("?", b)), 0 < c ? a.substring(b, c) : a.substring(b));
}

function onModeCheckboxChange(){

}

function OnExclusionCheckboxChange(){

}


