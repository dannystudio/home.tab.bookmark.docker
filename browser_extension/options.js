const host = document.getElementById('host');
const apikey = document.getElementById('apikey');
const saveBtn = document.getElementById('saveBtn');

// browserObj.storage.local.get('home-tab-bookmark-host', data => host.value = data['home-tab-bookmark-host'] || defaultTestUrl);
// browserObj.storage.local.get('home-tab-bookmark-api-key', data => apikey.value = data['home-tab-bookmark-api-key'] || '');

saveBtn.addEventListener('click', () => {
    const hostValue = host.value.trim();
    const apikeyValue = apikey.value.trim();
    if (hostValue == '' || apikeyValue == '') {
        document.getElementById('host_error').innerHTML =  hostValue == '' ? 'Required' : '';
        document.getElementById('apikey_error').innerHTML =  apikeyValue == '' ? 'Required' : '';
    }
    else {
        browserObj.storage.local.set({'home-tab-bookmark-host': host.value});
        browserObj.storage.local.set({'home-tab-bookmark-api-key': apikey.value});
        const output = document.getElementById('output');
        output.innerHTML = 'Saved';
        setTimeout(() => {
            output.innerHTML = '';
        }, 5000);
    }
});

const setFormData = async () => {
    const data = await getStorageData(true);
    host.value = data.hostName;
    apikey.value = data.apiKey;
};

document.addEventListener('DOMContentLoaded', setFormData);