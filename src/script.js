let homeTabData = {};
let groupForm, bookmarkForm, uploadForm;
let messageTimer;
let forceOpenInNewTab = false;
const editingMemo = [];  // [index, name/label, url, thumbnail]

const qs = (selector, all = false) => {
    return (typeof selector === 'string' ? (!all ? document.querySelector(selector) : document.querySelectorAll(selector)) : selector);
};

const attr = (selector, arrtProps) => {
    const obj = qs(selector);
    for (const prop in arrtProps) {
        obj.setAttribute(prop, arrtProps[prop]);
    }
};

const html = (selector, content = '') => {
    qs(selector).innerHTML = content;
};

const create = (tag, ...props) => {
    const obj = document.createElement(tag);
    const [content, classname, attributes] = props;
    if (attributes !== undefined) {
        for (const attr in attributes) {
            obj.setAttribute(attr, attributes[attr]);
        }
    }
    content !== undefined && content !== '' && (obj.innerHTML = content);
    classname !== undefined && (obj.className = classname);
    return obj;  
};

const setDragStartState = obj => {
    addClass(obj, 'drag-start-state');
};

const setDragEndState = obj => {
    removeClass(obj, 'drag-start-state');
};

const setGruopVisibility = () => {
    const groups = homeTabData.groups;
    const menuIconX = getBoundingProps('.app-menu-icon').x;
    const hiddenGroups = [];
    const addGropuObj = qs('.add-new-group');
    if (getBoundingProps(addGropuObj).right > menuIconX) {
        addClass(addGropuObj, 'group-visibility-hidden');
        hiddenGroups.push(addGropuObj);
    }
    else {
        removeClass(addGropuObj, 'group-visibility-hidden')
    }
    groups.forEach((group, index) => {
        const groupObj = qs(`#group${index}`);
        const groupObjProps = getBoundingProps(groupObj);
        if (groupObjProps.right > menuIconX) {
            addClass(groupObj, 'group-visibility-hidden');
            hiddenGroups.push(groupObj);
        }
        else {
            removeClass(groupObj, 'group-visibility-hidden');
        }
    });
    renderAppMenuContent(hiddenGroups);
};

const getBoundingProps = selector => {
    return qs(selector).getBoundingClientRect();
};

const setValue = (selector, value = '') => {
    qs(selector).value = value;
};

const getValue = selector => {
    return qs(selector).value;
};

const setFormValues = (form, values = []) => {
    const inputs = Array.from(form.childNodes).filter(child => child.tagName == 'INPUT' && child.type.match(/hidden|text/i));
    inputs.forEach((input, index) => input.value = values[index]);    
};

const getFormValues = form => {
    const values = [];
    const inputs = Array.from(form.childNodes).filter(child => child.tagName == 'INPUT' && child.type.match(/hidden|text/i));
    inputs.forEach(input => values.push(input.value));
    return values;
};

const verifyData = (data) => {
    if (typeof data.current_group === 'undefined' ||
        typeof data.groups === 'undefined' ||
        data.groups.length == 0 ||
        !Array.isArray(data.groups) ||
        typeof data.groups[0].bookmarks === 'undefined' ||
        !Array.isArray(data.groups[0].bookmarks)
    ) return false;
    return true;
};

const getDataFromServer = (isInit) => {
    fetch('/process/?action=restore')
    .then(resp => resp.json())
    .then(data => {
        if (verifyData(data.home_tab_data)) {
            homeTabData = data.home_tab_data;
            if (isInit) {
                doneInit();
            }
            else {
                renderGroups();
                goToGroup(homeTabData.current_group);
                showMessagePopup('Data restore successfully.', 'info');
            }
        }
        else {
            showMessagePopup('Data corrupted, try import data from local machine.');
        }
    })
    .catch(error => {
        showMessagePopup('Error while retrieving data, please try again later.');
    });    
};

const setDataToServer = () => {
    if (verifyData(homeTabData)) {
        homeTabData.timestamp = Date.now();
        fetch('/process/?action=backup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({home_tab_data: homeTabData})
        })
        .then(resp => {
            resp.ok && showMessagePopup('Data backup successfully.', 'info');
        })
        .catch(error => {
            showMessagePopup('Error while backup data, please try again later.');
        }); 
    }
    else {
        showMessagePopup('Data corrupted, try restore data.');
    }
};

const getDataFromLocal = () => {
    const data = JSON.parse(localStorage.getItem('home-tab-data'));
    if (verifyData(data)) {
        homeTabData = data;
        doneInit();
        return true;
    }
    else {
        showMessagePopup('Data corrupted, try restore data.');
        return false;
    }    
};

const setDataToLocal = (skipVerify = false) => {
    const verifyResult = skipVerify ? true : verifyData(homeTabData);
    if (verifyResult) {
        homeTabData.timestamp = Date.now();
        localStorage.setItem('home-tab-data', JSON.stringify(homeTabData));
        return true;
    }
    else {
        showMessagePopup('Data corrupted, try restore data.');
        return false;
    }
};

const addClass = (selector, ...classname) => {
    [...classname].forEach(name => qs(selector).classList.add(name));
};

const removeClass = (selector, ...classname) => {
    [...classname].forEach(name => qs(selector).classList.remove(name));
};

const show = (selector, disp = 'flex') => {
    qs(selector).style.display = disp;
};

const hide = (...selectors) => {
    [...selectors].forEach(sel => qs(sel).style.display = 'none');
};

const disableForm = (formObj, ...additionalSelector) => {
    formObj.childNodes.forEach(child => child.disabled = true);
    [...additionalSelector].forEach(sel => qs(sel).disabled = true);
};

const enableForm = (formObj, ...additionalSelector) => {
    formObj.childNodes.forEach(elem => elem.disabled = false);
    [...additionalSelector].forEach(sel => qs(sel).disabled = false);
};

const closeMessagePopup = () => {
    const messageObj = qs('.message-container');
    const type = messageObj.getAttribute('message-type');
    hide('.message-mask', '.message-confirm-button-container', '.message-progress-bar');
    html('.message-body');
    removeClass('.message-container', `message-${type}-theme`, 'message-default-cursor', 'message-container-show');
    removeClass('.message-progress-bar', `message-${type}-progress-bar`);
    removeClass('.message-progress-bar-fill', `message-${type}-theme`, 'message-progress-bar-fill-run');
    messageTimer && clearTimeout(messageTimer);  
};

const showMessagePopup = (message, type = 'alert', confirmCallback) => { // type == alert || info || confirm
    const messageSymbol  = (type == 'alert' ? '&#9785;' : `<div class="message-symbol-enlarged">${(type == 'info' ? '&#9786;' : '&#9888;')}</div>`);
    html('.message-body', `${messageSymbol} ${message}`);
    attr('.message-container', {'message-type': type});
    addClass('.message-container', `message-${type}-theme`);
    if (type == 'confirm') {
        addClass('.message-container', 'message-default-cursor');
        show('.message-confirm-button-container');
        if (confirmCallback) {
            confirmCallback.confirmed && qs('.message-confirm').addEventListener('click', confirmCallback.confirmed);
            confirmCallback.cancelled && qs('.message-cancel').addEventListener('click', confirmCallback.cancelled);
        }
    }
    else {
        show('.message-progress-bar', 'block');
        addClass('.message-progress-bar', `message-${type}-progress-bar`);
        addClass('.message-progress-bar-fill', `message-${type}-theme`);
        setTimeout(() => {
            addClass('.message-progress-bar-fill', 'message-progress-bar-fill-run');
        }, 50);
        messageTimer = setTimeout(closeMessagePopup, 5000);
    }
    addClass('.message-container', 'message-container-show');
    show('.message-mask');
};

const renderAppMenuContent = (hiddenGroups = []) => {
    const container = qs('.app-menu-content');
    html(container);
    if (hiddenGroups.length > 0) {  
        let addGroupButton;      
        hiddenGroups.forEach(group => {
            if (group.innerHTML == '+') {
                addGroupButton = create('div', '+ Add Group');
                addGroupButton.addEventListener('click', addGroup);                 
            }
            else {
                const index = group.getAttribute('group-index');
                const groupItem = create('div', group.innerHTML, '', {'group-index': index});
                index == homeTabData.current_group && addClass(groupItem, 'group-selected');
                groupItem.addEventListener('click', () => {
                    closeAppMenu();
                    goToGroup(index);
                    setGruopVisibility();
                });
                groupItem.addEventListener('contextmenu', editGroup);
                container.append(groupItem);
            }
        });
        addGroupButton && container.append(addGroupButton); 
        const divider = create('div', '', 'app-menu-divider');
        container.append(divider);        
    }
    const dataMenu = [];
    const importDataItem = create('div', '&#9900; Import Data');
    importDataItem.addEventListener('click', initImportData);
    dataMenu.push(importDataItem);
    const exportDataItem = create('div', '&#9900; Export Data');
    exportDataItem.addEventListener('click', exportData);
    dataMenu.push(exportDataItem);
    const backupDataItem = create('div', '&#9900; Backup Data');
    backupDataItem.addEventListener('click', () => {
        setDataToServer();
        closeAppMenu();
    });
    const restoreDataItem = create('div', '&#9900; Restore Data');
    restoreDataItem.addEventListener('click', () => {
        getDataFromServer();
        closeAppMenu();
    });
    dataMenu.push(backupDataItem, restoreDataItem);
    container.append(...dataMenu);
};

const renderGroups = () => {
    const groups = homeTabData.groups;
    const container = qs('.group-container');
    html(container);
    container.addEventListener('click', closeAppMenu);
    groups.forEach((group, groupIndex) => {
        const groupItem = create('div', group.name, 'group-label center', {
            id: `group${groupIndex}`,
            'group-index': groupIndex,
            'draggable': true
        });
        groupItem.addEventListener('click', () => {
            closeAppMenu();
            goToGroup(groupIndex);
        });
        groupItem.addEventListener('dragstart', setGroupDrag);        
        groupItem.addEventListener('dragend', moveGroup);             
        groupItem.addEventListener('contextmenu', editGroup);
        container.append(groupItem);
    });
    const addGroupButton = create('div', '+', 'group-label add-new-group center');
    addGroupButton.addEventListener('click', addGroup);
    container.append(addGroupButton);
    setGruopVisibility();
};

const renderBookmarks = data => {
    const container = qs('.bookmark-container');
    html(container);
    container.addEventListener('click', closeAppMenu);
    data.forEach((bookmark, bookmarkIndex) => {
        const bookmarkItem = create('div', '', 'bookmark-item', {
            id: `bookmark${bookmarkIndex}`,
            draggable: true
        });
        bookmarkItem.addEventListener('click', () => {
            closeAppMenu();
            if (forceOpenInNewTab || (typeof openInNewTab !== 'undefined' && openInNewTab)) {
                forceOpenInNewTab = false;
                setTimeout(() => {
                    window.open(bookmark.url);
                }, 50);
            }
            else {
                top.location.href = bookmark.url;
            }
        });
        bookmarkItem.addEventListener('dragstart', setBookmarkDrag);       
        bookmarkItem.addEventListener('dragend', moveBookmark);         
        bookmarkItem.addEventListener('contextmenu', () => {
            editBookmark(bookmark, bookmarkIndex);
        });
        const bookmarkThumb = create('div', '', 'bookmark-thumbnail');
        bookmarkThumb.style.background = `url(/thumbnail/${bookmark.thumbnail})`;
        const bookmarkLabel = create('div', bookmark.label, 'bookmark-label center');
        bookmarkItem.append(bookmarkThumb, bookmarkLabel);
        container.append(bookmarkItem);
    });
    const addBookmarkButton = create('div', '+', 'bookmark-item add-new-bookmark center');
    addBookmarkButton.addEventListener('click', addBookmark);
    container.append(addBookmarkButton);
};

const goToGroup = (group = 0) => {
    const currentGroup = homeTabData.current_group;
    removeClass(`#group${currentGroup}`, 'group-selected');
    addClass(`#group${group}`, 'group-selected');
    renderBookmarks(homeTabData.groups[group].bookmarks);
    homeTabData.current_group = group;
    setDataToLocal();
};

const closeGroupForm = () => {
    groupForm.reset();
    editingMemo.length = 0;
    hide('.popup-mask', '.group-form', '.edit-group-icon-container');
    removeClass('.group-form', 'form-container-show');
    return false;
};

const showGroupForm = () => {
    closeAppMenu();
    const type = getValue('.group-form-index') == -1 ? 'Add' : 'Edit';
    html('.group-form-header', `${type} Group`);
    html('.group-form-submit-button', type == 'Add' ? 'Add' : 'Save');
    show('.popup-mask');
    setTimeout(() => {
        addClass('.group-form', 'form-container-show');
    }, 100);   
    show('.group-form', 'block');
};

const setGroupDrag = event => {
    closeAppMenu();
    const sourceObj = event.target;
    attr(sourceObj, {'starting-point': event.clientX});
    setDragStartState(sourceObj);
};

const moveGroup = event => {
    if (homeTabData.groups.length < 2) return;
    const sourceObj = event.target;
    const sourceIndex = sourceObj.id.slice(5);
    const startingPoint = sourceObj.getAttribute('starting-point');
    const dropPoint = getBoundingProps(sourceObj).x + (event.clientX - startingPoint);
    const groups = homeTabData.groups;
    const newGroups = [];
    let currentGroup = homeTabData.current_group;
    let newIndex = 0;
    let inserted = false;
    const currentGroupName = groups[currentGroup].name;
    setDragEndState(sourceObj);
    groups.forEach((group, index) => {
        if (getBoundingProps(`#group${index}`).x + 10 <= dropPoint) {
            index != sourceIndex && newGroups.push(group);
        }
        else {
            if (!inserted) {
                newGroups.push(groups[sourceIndex]);               
                inserted = true;
            }
            index != sourceIndex && newGroups.push(group);
        }
        newIndex ++;
    });
    if (!inserted) {
        newGroups.push(groups[sourceIndex]);              
        inserted = true;
    }
    const getGroupIndexByName = (groups, name) => {
        let result = 0;
        groups.forEach((group, index) => {
            group.name == name && (result = index);
        });
        return result;
    };
    currentGroup = getGroupIndexByName(newGroups, currentGroupName);
    homeTabData.current_group = currentGroup;
    homeTabData.groups = newGroups;
    if (setDataToLocal()) {
        renderGroups();
        goToGroup(currentGroup);
    }
};

const editGroup = event => {
    const group = event.target;
    const groupIndex = group.getAttribute('group-index');
    const groupName = group.innerText;
    setFormValues(groupForm, [
        groupIndex,
        groupName
    ]);
    show('.edit-group-icon-container');
    editingMemo.push(groupIndex, groupName);
    showGroupForm();
    return false;
};

const addGroup = () => {
    setValue('.group-form-index', -1);
    showGroupForm();
};

const checkExistingGroupName = (groupIndex, groupName) => {
    const groups = homeTabData.groups;
    if (groupIndex != -1 && groups[groupIndex].name == groupName) {
        return false;
    }
    for (let i = 0; i < groups.length; i ++) {
        if (i == groupIndex) continue;
        if (groups[i].name == groupName) {
            return true;
        }
    }
    return false;
};

const submitGroupForm = () => {
    let [groupIndex, groupName] = getFormValues(groupForm);
    if (groupName.trim() !== '') {
        if (!checkExistingGroupName(groupIndex, groupName)) {
            const type = groupIndex == -1 ? 'Add' : 'Edit';
            if (type == 'Add') {
                homeTabData.groups.push({
                    name: groupName,
                    bookmarks: []
                });
                groupIndex = homeTabData.groups.length - 1;
            }
            else {
                homeTabData.groups[groupIndex].name = groupName;
            }
            if (setDataToLocal()) {
                renderGroups();
                goToGroup(groupIndex);
                setGruopVisibility();
                closeGroupForm();
            }
        }
        else {
            showMessagePopup(`&#34;${groupName}&#34; already exist, please use another name.`);
        }
    }
    else {
        showMessagePopup('Group Name cannot be empty.');
        
    }
    return false;
};

const closeBookmarkForm = () => {
    bookmarkForm.reset();
    editingMemo.length = 0;
    enableForm(bookmarkForm, '.close-bookmark-form', '.delete-bookmark-icon', '.reload-thumbnail-icon');
    removeClass('.bookmark-form', 'form-disabled', 'bookmark-form-expand');
    hide('.popup-mask', '.bookmark-form', '.edit-bookmark-icon-container');
    removeClass('.bookmark-form', 'form-container-show');
    return false;
};

const showBookmarkForm = () => {
    closeAppMenu();
    const reloadIcon = qs('.reload-thumbnail-icon');
    let clickEventRegisted = reloadIcon.getAttribute('click-registered') == 'true';
    if (!clickEventRegisted) {
        if (typeof hasScreenshotAPI !== 'undefined' && hasScreenshotAPI) {
            reloadIcon.addEventListener('click', showReloadThumbnailOption);
        }
        else {
            reloadIcon.addEventListener('click', () => {
                reloadThumbnail('icon');
            });
        }
        attr(reloadIcon, {'click-registered': (!clickEventRegisted).toString()});
        show('.reload-thumbnail-options');
    }
    const type = getValue('.bookmark-form-index') == -1 ? 'Add' : 'Edit';
    html('.bookmark-form-header', `${type}  Bookmark`);
    html('.bookmark-form-submit-button', type == 'Add' ? 'Add' : 'Save');
    show('.popup-mask');
    setTimeout(() => {
        addClass('.bookmark-form', 'form-container-show');
    }, 100);
    show('.bookmark-form', 'block');
};

const setBookmarkDrag = event => {
    closeAppMenu();
    const sourceObj = event.target;
    attr(sourceObj, {'starting-point': JSON.stringify({
        x: event.clientX,
        y: event.clientY
    })});
    setDragStartState(sourceObj);
};

const findGrooupMoveTo = dropX => {
    const groupObjs = qs('.group-label', true);
    for (let i = 0 ; i < groupObjs.length; i++) {
        const groupProps = getBoundingProps(groupObjs[i]);
        if (dropX >= groupProps.left && dropX <= groupProps.right) {
            return i;
        }
    }
    return null;
};

const moveBookmark = event => {
    const sourceObj = event.target;
    const sourceIndex = sourceObj.id.slice(8);
    const startingPoint = JSON.parse(sourceObj.getAttribute('starting-point'));
    const dropPointX = getBoundingProps(sourceObj).x + (event.clientX - startingPoint.x);
    const dropPointY = getBoundingProps(sourceObj).y + (event.clientY - startingPoint.y);
    const currentGroup = homeTabData.current_group;
    const bookmarks = homeTabData.groups[homeTabData.current_group].bookmarks;
    let newBookmarks = [];
    let increasementY, dropPointFlatX, inserted;
    const bodyWidth = document.body.clientWidth;
    const baseY = getBoundingProps('#bookmark0').bottom;
    const isMoveToGroup = dropPointY < getBoundingProps('.group-container').bottom;
    setDragEndState(sourceObj);
    // move to other group
    if (isMoveToGroup) {
        const sourceBookmark = homeTabData.groups[currentGroup].bookmarks[sourceIndex];
        const groupIndex = findGrooupMoveTo(dropPointX);
        newBookmarks = homeTabData.groups[currentGroup].bookmarks;
        if (currentGroup != groupIndex) {
            if (!checkExistingBookmarkLabel(groupIndex, -1, sourceBookmark.label)) {
                homeTabData.groups[groupIndex].bookmarks.push({
                    label: sourceBookmark.label,
                    url: sourceBookmark.url,
                    thumbnail: sourceBookmark.thumbnail
                });
                newBookmarks = homeTabData.groups[currentGroup].bookmarks.filter((bookmark, index) => index != sourceIndex);
            }
            else {
                showMessagePopup(`&#34;${sourceBookmark.label}&#34; already exist in &#34;${homeTabData.groups[groupIndex].name}&#34; group.`);
            }
        }
    }
    else {
        bookmarks.forEach((bookmark, index) => {
            const bookmarkPosition = getBoundingProps(`#bookmark${index}`);
            let bookmarkFlatX = bookmarkPosition.x;
            if (bookmarkPosition.bottom != baseY) {
                if (!increasementY) {
                    increasementY = bookmarkPosition.bottom - baseY;
                }
                bookmarkFlatX = (bodyWidth * ((bookmarkPosition.bottom - baseY) / increasementY)) + bookmarkPosition.x;
            }
            if (dropPointY < baseY) {
                dropPointFlatX = dropPointX;
            }
            else {
                dropPointFlatX = (bodyWidth * Math.floor(dropPointY / baseY)) + dropPointX;
            }
            if (bookmarkFlatX <= dropPointFlatX) {
                if (index != sourceIndex) {
                    newBookmarks.push(bookmark);
                }
            }
            else {
                if (!inserted) {
                    newBookmarks.push(bookmarks[sourceIndex]);               
                    inserted = true;
                }
                if (index != sourceIndex) {
                    newBookmarks.push(bookmark);
                }
            }        
        });
        if (!inserted) {
            newBookmarks.push(bookmarks[sourceIndex]);              
            inserted = true;
        }
    }
    if (isMoveToGroup || newBookmarks.length > 0) {
        homeTabData.groups[currentGroup].bookmarks = newBookmarks;
        if (setDataToLocal()) {
            renderBookmarks(newBookmarks);
        }
    }
};

const editBookmark = (bookmark, bookmarkIndex) => {
    const bookmarkLabel = bookmark.label;
    const bookmarkUrl = bookmark.url;
    const bookmarkThumbnail = bookmark.thumbnail;
    setFormValues(bookmarkForm, [
        bookmarkIndex,
        bookmarkUrl,
        bookmarkLabel,
    ]);
    show('.edit-bookmark-icon-container');
    editingMemo.push(bookmarkIndex, bookmarkLabel, bookmarkUrl, bookmarkThumbnail);
    showBookmarkForm();
    return false;
};

const addBookmark = () => {
    setValue('.bookmark-form-index', -1);
    showBookmarkForm();
};

const checkExistingBookmarkLabel = (groupIndex, bookmarkIndex, bookmarkLabel) => {
    const bookmarks = homeTabData.groups[groupIndex].bookmarks;
    if (bookmarkIndex != -1 && bookmarks[bookmarkIndex].label == bookmarkLabel) {
        return false;
    }
    for (let i = 0; i < bookmarks.length; i ++) {
        if (i == bookmarkIndex) continue;
        if (bookmarks[i].label == bookmarkLabel) {
            return true;
        }
    }
    return false;
}; 

const submitBookmarkForm = () => {
    const currentGroup = homeTabData.current_group;
    const [bookmarkIndex, bookmarkUrl, bookmarkLabel]= getFormValues(bookmarkForm);   
    if (bookmarkLabel.trim() !== '' && bookmarkUrl.trim() !== '') {        
        if (!checkExistingBookmarkLabel(currentGroup, bookmarkIndex, bookmarkLabel)) {
            const type = bookmarkIndex == -1 ? 'Add' : 'Edit';
            if (type == 'Add') {
                html('.bookmark-form-submit-button', '<img src="image/loading.png">');
                disableForm(bookmarkForm, '.close-bookmark-form');
                fetch(`/process/?action=reload&url=${bookmarkUrl}`)
                .then(resp => resp.json())
                .then(data => {
                    if (data.message) {
                        showMessagePopup(data.message);
                    }
                    homeTabData.groups[currentGroup].bookmarks.push({
                        label: bookmarkLabel,
                        url: bookmarkUrl,
                        thumbnail: data.filename
                    });
                    if (setDataToLocal()) {
                        goToGroup(currentGroup); 
                        closeBookmarkForm();
                    }
                })
                .catch(error => {
                    showMessagePopup('Error, please try again later.');
                });
            }
            else {
                const targetDataBlock = homeTabData.groups[currentGroup].bookmarks[bookmarkIndex];
                targetDataBlock.label = bookmarkLabel;
                targetDataBlock.url = bookmarkUrl;
                if (setDataToLocal()) {
                    goToGroup(currentGroup);
                    closeBookmarkForm();
                }
            }
        }
        else {
            showMessagePopup(`&#34;${bookmarkLabel}&#34; already exist, please use another label.`);
        }    
    }
    else {
        showMessagePopup('URL and Label cannot be empty.');
    }
    return false;
};

const cancelDeleteItem = () => {
    closeMessagePopup();
};

const preceedDeleteItem = () => {
    let currentGroup = homeTabData.current_group;
    const [itemIndex, , , bookmarkThumbnail] = editingMemo;
    const isGroup = editingMemo.length == 2;
    if (isGroup) {
        const groupHolder = homeTabData.groups.filter((group, index) => {
            return index != itemIndex;
        });
        homeTabData.groups = groupHolder;
        itemIndex == currentGroup && (currentGroup = 0);
        itemIndex < currentGroup && (currentGroup = currentGroup - 1);
        homeTabData.current_group = currentGroup;
        if (setDataToLocal()) {
            renderGroups();
            goToGroup(currentGroup);
            closeGroupForm();
            closeMessagePopup();
        }
    }
    else {
        fetch(`/process/?action=delete&filename=${bookmarkThumbnail}`)
        .then(resp => {
            if (resp.ok) {
                const bookmarkHolder = homeTabData.groups[currentGroup].bookmarks.filter((bookmark, index) => {
                    return index != itemIndex;
                });
                homeTabData.groups[currentGroup].bookmarks = bookmarkHolder;
                if (setDataToLocal()) {
                    goToGroup(currentGroup);
                    closeBookmarkForm();
                    closeMessagePopup();                    
                }
            }
        })
        .catch(error => {
            showMessagePopup('Error, please try again later.');
            closeBookmarkForm();
            closeMessagePopup();
        });
    }
};

const deleteItem = () => {
    const [ , itemNameLabel] = editingMemo;
    const isGroup = editingMemo.length == 2;
    if (isGroup && homeTabData.groups.length == 1) {
        showMessagePopup('You need at least one group for bookmarks.');
        return false;
    }
    let message = `Do you want to delete &#34;${itemNameLabel}&#34;?`;
    isGroup && (message += '<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;This will also remove bookmarks in this group.');
    showMessagePopup(message, 'confirm', {
        confirmed: preceedDeleteItem,
        cancelled: cancelDeleteItem
    });
};

const showReloadThumbnailOption = () => {
    addClass('.bookmark-form', 'bookmark-form-expand');
};

const reloadThumbnail = type => {
    const [bookmarkIndex, , bookmarkUrl, deleteThumbnail] = editingMemo;
    html('.bookmark-form-submit-button', '<img src="image/loading.png">');
    disableForm(bookmarkForm, '.close-bookmark-form', '.delete-bookmark-icon', '.reload-thumbnail-icon');
    addClass('.bookmark-form', 'form-disabled');
    removeClass('.bookmark-form', 'bookmark-form-expand');
    const currentGroup = homeTabData.current_group;
    fetch(`/process/?action=reload&type=${type}&url=${bookmarkUrl}&delete=${deleteThumbnail}`)
    .then(resp => resp.json())
    .then(data => {
        data.message && showMessagePopup(data.message);
        homeTabData.groups[currentGroup].bookmarks[bookmarkIndex].thumbnail = data.filename;
        if (setDataToLocal()) {
            goToGroup(currentGroup);
            closeBookmarkForm();
        }
    })
    .catch(error => {
        showMessagePopup('Error, please try again later.');
        closeBookmarkForm();
    });     
};

const closeDropContainer = () => {
    uploadForm.reset();    
    hide('.popup-mask', '.drop-area-container');
};

const importData = (files) => {
    const uploadFile = files[0];    // only handle the first file
    if (uploadFile.type != 'application/json') {
        showMessagePopup('Invalid file format.');
        uploadForm.reset();
    }
    else {
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const fileContent = event.target.result;
                const newData = JSON.parse(fileContent);
                if (verifyData(newData.home_tab_data)) {
                    homeTabData = newData.home_tab_data;
                    setDataToLocal(true);
                    renderGroups();
                    goToGroup(homeTabData.current_group);
                    closeDropContainer();
                    showMessagePopup('Data import successfully.', 'info');
                }
                else {
                    showMessagePopup('Invalid file data.');
                    uploadForm.reset();                   
                }
            }
            catch (error) {
                showMessagePopup('Error, please try again later.');
                uploadForm.reset(); 
            }
        };
        reader.readAsText(uploadFile);
    }
};

const initImportData = () => {
    const preventDefaults = event => {
        event.preventDefault();
        event.stopPropagation();
    };
    
    const dragEnter = () => {
        addClass('.drop-area-container', 'dragging-in');
    };
      
    const dragLeave  = () => {
        removeClass('.drop-area-container', 'dragging-in');
    };

    const handleDrop = event => {
        const dt = event.dataTransfer;
        const files = dt.files;
        importData(files);
    }

    const dropArea = qs('.drop-area-container');
    const listenToEvents = dropArea.getAttribute('listen-to-event') == 'true';
    if (!listenToEvents) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            dropArea.addEventListener(event, preventDefaults);
        });
          
        ['dragenter', 'dragover'].forEach(event => {
            dropArea.addEventListener(event, dragEnter);
        });
          
        ['dragleave', 'drop'].forEach(event => {
            dropArea.addEventListener(event, dragLeave);
        });
        attr(dropArea, {'listen-to-event': (!listenToEvents).toString()});
    }
    dropArea.addEventListener('drop', handleDrop, false);
    closeAppMenu();
    show('.popup-mask');
    show('.drop-area-container', 'block');
};

const exportData = () => {
    closeAppMenu();
    const dataString = 'data:text/json;charset=utf-8,' + encodeURIComponent(`{"home_tab_data":${JSON.stringify(homeTabData)}}`);
    const exportDataAnchor = create('a', '', '', {
        href: dataString,
        download: 'home-tab-bookmark-data.json'
    });
    exportDataAnchor.click();   
};

const closeAppMenu = () => {
    qs('.app-menu-content').getAttribute('displayed') == 'true' && toggleAppMenu();
};

const toggleAppMenu = () => {
    const menuContentDiv = qs('.app-menu-content');
    let displayed = menuContentDiv.getAttribute('displayed') == 'true';
    displayed ? removeClass('.app-menu-container', 'app-menu-container-show') : addClass('.app-menu-container', 'app-menu-container-show');
    displayed ? removeClass(menuContentDiv, 'app-menu-content-expand') : addClass(menuContentDiv, 'app-menu-content-expand');
    attr(menuContentDiv, {displayed: (!displayed).toString()});
};

const handleKeyPressed = event => {
    if (event.key == 'Escape') {
        if (qs('.message-mask').style.display != 'none') {
            closeMessagePopup();
        }
        else if (qs('.popup-mask').style.display != 'none') {
            closeGroupForm();
            closeBookmarkForm();
            closeDropContainer();
        }
        closeAppMenu();
    }
    event.key == 'Shift' && (forceOpenInNewTab = true);
};

const handleKeyReleased = event => {
    event.key == 'Shift' && (forceOpenInNewTab = false); 
};

const doneInit = () => {
    renderGroups();
    goToGroup(homeTabData.current_group);
    document.addEventListener("dragover", event => event.preventDefault());
    document.addEventListener("scroll", closeAppMenu);
    document.addEventListener('keydown', handleKeyPressed);
    document.addEventListener('keyup', handleKeyReleased);
    document.addEventListener("visibilitychange", () => {forceOpenInNewTab = false});
    window.addEventListener('resize', setGruopVisibility);
    setGruopVisibility();
};

const init = () => {
    if (localStorage) {
        renderAppMenuContent();
        [groupForm, bookmarkForm, uploadForm] = document.forms;
        !localStorage.getItem('home-tab-data') ? getDataFromServer(true) : getDataFromLocal(true);
    }
    else {
        showMessagePopup('Sorry, your browser does not support this Appp.');
    }
};

document.addEventListener("DOMContentLoaded", init);