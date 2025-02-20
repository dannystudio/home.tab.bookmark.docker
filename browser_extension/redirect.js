browserObj.storage.local.get('hometabbookmarkurl', data => {
    const url = data['hometabbookmarkurl'] || defaultTestUrl;
    document.location = url;
});