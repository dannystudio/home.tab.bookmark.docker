let baseUrl = '';
(async () => {
    if (document.location.href.match(/^(http|https)/) == null) {
        const isFireFox = navigator.userAgent.match(/firefox/i) != null;
        const browserObj = isFireFox ? browser : chrome;
        await browserObj.storage.local.get('home-tab-bookmark-host', data => {
            baseUrl = data['home-tab-bookmark-host'] || 'http://localhost:3000';
        });
    }
    (() => {
        const mainJS = document.createElement('script');
        mainJS.src = '/script.js';
        document.getElementsByTagName('head')[0].append(mainJS);
    })();
})();