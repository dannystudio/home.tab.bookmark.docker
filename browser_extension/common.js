const isFireFox = navigator.userAgent.match(/firefox/i) != null;
const browserObj = isFireFox ? browser : chrome;
const defaultTestUrl = 'http://localhost:3000';

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