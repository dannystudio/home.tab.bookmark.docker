const host = document.getElementById('host');
const apikey = document.getElementById('apikey');
const saveBtn = document.getElementById('saveBtn');
const browserObj = new browserAPI();

saveBtn.addEventListener('click', () => {
    const hostValue = host.value.trim();
    const apikeyValue = apikey.value.trim();
    if (hostValue == '' || apikeyValue == '') {
        document.getElementById('host_error').innerHTML =  hostValue == '' ? 'Required' : '';
        document.getElementById('apikey_error').innerHTML =  apikeyValue == '' ? 'Required' : '';
    }
    else {
        browserObj.setStorageData({
            host: host.value.trim(),
            apikey: apikey.value.trim()
        });
        const output = document.getElementById('output');
        output.innerHTML = 'Saved';
        setTimeout(() => {
            output.innerHTML = '';
        }, 5000);
    }
});

const setFormData = async () => {
    const data = await browserObj.getStorageData(true);
    host.value = data.hostName;
    apikey.value = data.apiKey;
};

document.addEventListener('DOMContentLoaded', setFormData);