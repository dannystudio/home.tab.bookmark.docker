class browserAPI {
    constructor () {
		this.browserObj = navigator.userAgent.match(/firefox/i) != null ? browser : chrome;
        this.defaultTestUrl = 'http://localhost:3000';
	}

    setStorageData(data) {
        this.browserObj.storage.local.set({'home-tab-bookmark-host': data.host});
        this.browserObj.storage.local.set({'home-tab-bookmark-api-key': data.apikey});
    }

    async getStorageData(useDefault) {
        const hostData = await this.browserObj.storage.local.get('home-tab-bookmark-host');
        const hostName = hostData['home-tab-bookmark-host'];
        const apikeyData = await this.browserObj.storage.local.get('home-tab-bookmark-api-key');
        const apiKey = apikeyData['home-tab-bookmark-api-key'];
        return {
            hostName: hostName ? hostName : (useDefault ? this.defaultTestUrl : ''),
            apiKey: apiKey ? apiKey : ''
        };
    }

    async getTabData() {
        return await this.browserObj.tabs.query({active: true, lastFocusedWindow: true});
    }
}