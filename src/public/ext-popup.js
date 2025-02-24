const groupContainer = document.getElementById('groupContainer');

const addToGroup = async event => {
    const data = await getStorageData();
    if (data.hostName && data.apiKey) {
        const groupName = event.target.innerHTML;
        const tabData = await browserObj.tabs.query({active: true, lastFocusedWindow: true});
        const url = tabData[0].url || '';
        const title = tabData[0].title || '';
        const junction = data.hostName.slice(-1) == '/' ? '' : '/';
        fetch(`${data.hostName}${junction}api/add/bookmark?apikey=${data.apiKey}&group=${groupName}&url=${url}&title=${title}`)
        .then(resp => resp.json())
        .then(data => {
            groupContainer.innerHTML = data.status == 200 ? `Tab saved in ${groupName}` : data.message;
            setTimeout(() => {
                window.close();
            }, 5000);
        })
        .catch(error => {
            console.log(`api > add to group error: ${error.message}`);
            groupContainer.innerHTML = 'Unable to add bookmark, please try again later.';
        });
    }
};

const getGroups = async () => {
    const data = await getStorageData();
    if (data.hostName && data.apiKey) {
        const junction = data.hostName.slice(-1) == '/' ? '' : '/';
        fetch(`${data.hostName}${junction}api/group?apikey=${data.apiKey}`)
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
            else {
                groupContainer.innerHTML = data.message;
            }
        })
        .catch(error => {
            console.log(`api > get group error: ${error.message}`);
            groupContainer.innerHTML = 'Unable to retrieve data, please try again later.';
        });
    }
    else {
        groupContainer.innerHTML = 'Please set up Host and API Key in extension options.';
    }
};

document.addEventListener('DOMContentLoaded', getGroups);