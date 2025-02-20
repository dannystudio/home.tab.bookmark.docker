const input = document.getElementById('url');
const setBtn = document.getElementById('setBtn');
chrome.storage.sync.get('hometabbookmarkurl', data => input.value = data['hometabbookmarkurl'] || defaultTestUrl);
setBtn.addEventListener('click', () => {
    chrome.storage.sync.set({'hometabbookmarkurl': input.value});
    window.close();
});