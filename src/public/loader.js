const isFireFox = navigator.userAgent.match(/firefox/i) != null;
const defaultTestUrl = 'http://localhost:3000';
let browserObj, baseUrl = defaultTestUrl;

const getStorageData = async useDefault => {
    const hostData = await browserObj.storage.local.get('home-tab-bookmark-host');
    const hostName = hostData['home-tab-bookmark-host'];
    const apikeyData = await browserObj.storage.local.get('home-tab-bookmark-api-key');
    const apiKey = apikeyData['home-tab-bookmark-api-key'];
    return {
        hostName: hostName ? hostName : (useDefault ? defaultTestUrl : ''),
        apiKey: apiKey ? apiKey : ''
    };
};

const loadMainScript = () => {
    const mainJS = document.createElement('script');
    mainJS.src = '/script.js';
    document.getElementsByTagName('head')[0].append(mainJS);
};

const initApp = async () => {
    if (!document.location) {
        browserObj = isFireFox ? browser : chrome;
        await browserObj.storage.local.get('home-tab-bookmark-host', data => {
            baseUrl = data['home-tab-bookmark-host'] || defaultTestUrl;
        });
    }
    loadMainScript();
};

initApp();