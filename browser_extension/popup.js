const addToGroup = event => {
    const groupName = event.target.innerHTML;
    browserObj.storage.local.get('home-tab-bookmark-host', data => {
        const hostname = data['home-tab-bookmark-host'] || defaultTestUrl;
        browserObj.storage.local.get('home-tab-bookmark-api-key', data => {
            const apikey = data['home-tab-bookmark-api-key'];
            browserObj.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
                const url = tabs[0].url || '';
                const title = tabs[0].title || '';
                fetch(`${hostname}/api/add/bookmark?apikey=${apikey}&group=${groupName}&url=${url}&title=${title}`)
                .then(resp => resp.json())
                .then(data => {
                    data.hasOwnProperty('result') && window.close();
                })
                .catch(error => groupContainer.innerHTML = error.message);
            });
        });
    });
};

const getGroups = () => {
    const groupContainer = document.getElementById('groupContainer');
    browserObj.storage.local.get('home-tab-bookmark-host', data => {
        const hostname = data['home-tab-bookmark-host'] || defaultTestUrl;
        browserObj.storage.local.get('home-tab-bookmark-api-key', data => {
            const apikey = data['home-tab-bookmark-api-key'];
            fetch(`${hostname}/api/group?apikey=${apikey}`)
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
            .catch(error => groupContainer.innerHTML = error.message);
        });
    });
};

getGroups();




// const input = document.getElementById('url');
// const setBtn = document.getElementById('setBtn');
// const useCurrent = document.getElementById('useCurrent');
// browserObj.storage.local.get('hometabbookmarkurl', data => input.value = data['hometabbookmarkurl'] || defaultTestUrl);
// setBtn.addEventListener('click', () => {
//     browserObj.storage.local.set({'hometabbookmarkurl': input.value});
//     window.close();
// });
// useCurrent.addEventListener('click', async () => {
//     browserObj.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
//         input.value =  tabs[0].url;
//         browserObj.storage.local.set({'hometabbookmarkurl': input.value});
//         window.close();
//     });
// });