const input = document.getElementById('url');
const setBtn = document.getElementById('setBtn');
const useCurrent = document.getElementById('useCurrent');
browserObj.storage.local.get('hometabbookmarkurl', data => input.value = data['hometabbookmarkurl'] || defaultTestUrl);
setBtn.addEventListener('click', () => {
    browserObj.storage.local.set({'hometabbookmarkurl': input.value});
    window.close();
});
useCurrent.addEventListener('click', async () => {
    browserObj.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
        input.value =  tabs[0].url;
        browserObj.storage.local.set({'hometabbookmarkurl': input.value});
        window.close();
    });
});