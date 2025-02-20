const input = document.getElementById('url');
const setBtn = document.getElementById('setBtn');
const useCurrent = document.getElementById('useCurrent');
chrome.storage.sync.get('hometabbookmarkurl', data => input.value = data['hometabbookmarkurl'] || defaultTestUrl);
setBtn.addEventListener('click', () => {
    chrome.storage.sync.set({'hometabbookmarkurl': input.value});
    window.close();
});
useCurrent.addEventListener('click', async () => {
    chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
        input.value =  tabs[0].url;
        chrome.storage.sync.set({'hometabbookmarkurl': input.value});
        window.close();
    });
});