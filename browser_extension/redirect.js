browserObj.storage.local.get('home-tab-bookmark-host', data => {
    const url = data['home-tab-bookmark-host'] || defaultTestUrl;
    document.location = url;
});