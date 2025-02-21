const groupContainer = document.getElementById('groupContainer');

const addToGroup = async event => {
    const data = await getStorageData();
    if (data.hostName && data.apiKey) {
        const groupName = event.target.innerHTML;
        const tabData = await browserObj.tabs.query({active: true, lastFocusedWindow: true});
        const url = tabData[0].url || '';
        const title = tabData[0].title || '';
        fetch(`${data.hostName}/api/add/bookmark?apikey=${data.apiKey}&group=${groupName}&url=${url}&title=${title}`)
        .then(resp => resp.json())
        .then(data => {
            groupContainer.innerHTML = `Tab saved in ${groupName}`;
            setTimeout(() => {
                window.close();
            }, 5000);
        })
        .catch(error => groupContainer.innerHTML = error.message);
    }
};

const getGroups = async () => {
    const data = await getStorageData();
    if (data.hostName && data.apiKey) {
        fetch(`${data.hostName}/api/group?apikey=${data.apiKey}`)
        .then(resp => resp.json())
        .then(data => {
            if (data.hasOwnProperty('groups')) {
                data.groups.forEach(group => {
                    const div = document.createElement('div');
                    div.className = 'group';
                    div.innerHTML = group;
                    div.addEventListener('click', addToGroup);
                    groupContainer.append(div);
                });
            }
        })
        .catch(error => groupContainer.innerHTML = 'Unable to get data, please try again later.');
    }
    else {
        groupContainer.innerHTML = 'Please set up Host and API Key in extension options.';
    }
};

getGroups();