let homeTabData = {};
let groupForm, bookmarkForm, dropAreaForm;
let messageTimer;
let forceOpenInNewTab = false;
const editingMemo = [];  // [index, name/label, url, thumbnail]
let apikey, rememberGroupIndex, openInNewTab, autoDismissTimeframe, maxBookmarkPerRow, uploadBuffer, bookmarkSpace;
const settingsMenuItem = ['general', 'appearance', 'data-management', 'api-key', 'about'];

const qs = (selector, all = false) => {
    return (typeof selector === 'string' ? (!all ? document.querySelector(selector) : document.querySelectorAll(selector)) : selector);
};

const attr = (selector, arrtProps) => {
    const obj = qs(selector);
    if (typeof arrtProps === 'object') {
        for (const prop in arrtProps) {
            obj.setAttribute(prop, arrtProps[prop]);
        }
    }
    else return obj.getAttribute(arrtProps);
};

const css = (selector, styleProps) => {
    const obj = qs(selector);
    if (typeof styleProps === 'object') {
        for (const prop in styleProps) {
            obj.style[prop] = styleProps[prop];
        }        
    }
    else return obj.style[styleProps];
};

const html = (selector, content) => {
    if (typeof content !== 'undefined') {
        qs(selector).innerHTML = content;
    }
    else return qs(selector).innerHTML;
};

const addClass = (selector, ...classname) => {
    [...classname].forEach(name => qs(selector).classList.add(name));
};

const removeClass = (selector, ...classname) => {
    [...classname].forEach(name => qs(selector).classList.remove(name));
};

const disableForm = (formObj, ...additionalSelector) => {
    Array.from(formObj.elements).forEach(elem => elem.disabled = true);
    [...additionalSelector].forEach(sel => qs(sel).disabled = true);
};

const enableForm = (formObj, ...additionalSelector) => {
    Array.from(formObj.elements).forEach(elem => elem.disabled = false);
    [...additionalSelector].forEach(sel => qs(sel).disabled = false);
};

const show = (selector, disp = 'flex') => {
    css(selector, {display: disp});
};

const hide = (...selectors) => {
    [...selectors].forEach(sel => css(sel, {display: 'none'}));
};

const create = (tag, ...props) => {
    const obj = document.createElement(tag);
    const [content, classname, attributes] = props;
    if (typeof attributes !== 'undefined') {
        for (const attr in attributes) {
            obj.setAttribute(attr, attributes[attr]);
        }
    }
    typeof content !== 'undefined' && content !== '' && html(obj, content);
    typeof classname !== 'undefined' && (obj.className = classname);
    return obj;  
};

const setBackground = (selector, path = '') => {
    css(selector, {backgroundImage: `url(${path})`});
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
    else removeClass(addGropuObj, 'group-visibility-hidden');
    groups.forEach((group, index) => {
        const groupObj = qs(`#group${index}`);
        const groupObjProps = getBoundingProps(groupObj);
        if (groupObjProps.right > menuIconX) {
            addClass(groupObj, 'group-visibility-hidden');
            hiddenGroups.push(groupObj);
        }
        else removeClass(groupObj, 'group-visibility-hidden');
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

const setDataToServer = async (saveToVar) => {
    if (isHomeTabBookmarkData(homeTabData)) {
        homeTabData.timestamp = Date.now();
        const formData = new FormData();
        formData.append('home_tab_data', `{"home_tab_data":${JSON.stringify(homeTabData)}}`);
        return await fetch(`${baseUrl}/set-data/`, {
            method: 'POST',
            header: {'Content-Type': 'multipart/form-data'},
            body: formData
        })
        .then(resp => {
            if (resp.status == 200) {
                return resp.json();
            }
            else saveToVar && showMessagePopup('Unable to retrieve data, please try again later.');
        })
        .then(data => saveToVar && (homeTabData = data))
        .catch(error => {
            showMessagePopup('Unable to retrieve data, please try again later.');
        }); 
    }
    else showMessagePopup('Data may have corrupted, please try import data from backup file.');
};

const getDataFromServer = event => {
    fetch(`${baseUrl}/get-data/`)    
    .then(resp => resp.json())
    .then(data => {
        if (isHomeTabBookmarkData(data.home_tab_data)) {
            if (event) {
                homeTabData = data.home_tab_data;
                doneInit();
            }
            else downloadDataFile(data);
        }
        else showMessagePopup('Data may have corrupted, please try import data from backup file.');
    })
    .catch(error => {
        console.log(error.message);
        showMessagePopup('Unable to retrieve data, please try again later.');
    });
};

const downloadDataFile = data => {
    const exportDataAnchor = create('a', '', '', {
        href: `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data))}`,
        download: 'home-tab-bookmark-data.json'
    });
    exportDataAnchor.click();
};

const closeMessagePopup = () => {
    const type = attr('.message-container', 'message-type');
    hide('.message-mask', '.message-confirm-button-container', '.message-progress-bar');
    html('.message-body-container', '');
    removeClass('.message-container', `message-${type}-theme`, 'message-default-cursor', 'message-container-show');
    removeClass('.message-progress-bar', `message-${type}-progress-bar`);
    removeClass('.message-progress-bar-fill', `message-${type}-theme`, 'message-progress-bar-fill-run');
    messageTimer && clearTimeout(messageTimer);
};

const showMessagePopup = (message, type = 'alert', confirmCallback) => { // type == alert || info || confirm
    const messageSymbol  = `<div class="message-symbol">${svgSource[type]}</div>`;
    html('.message-body-container', `${messageSymbol} <div class="message-body">${message}</div>`);
    attr('.message-container', {'message-type': type});
    addClass('.message-container', `message-${type}-theme`);
    if (type == 'confirm') {
        addClass('.message-container', 'message-default-cursor');
        show('.message-confirm-button-container');
        qs('.message-container').removeEventListener('click', closeMessagePopup);
        if (confirmCallback) {
            confirmCallback.confirmed && qs('.message-confirm').addEventListener('click', confirmCallback.confirmed);
            confirmCallback.cancelled && qs('.message-cancel').addEventListener('click', confirmCallback.cancelled);
        }
    }
    else {
        qs('.message-container').addEventListener('click', closeMessagePopup);
        show('.message-progress-bar', 'block');
        if (autoDismissTimeframe > 0) {
            addClass('.message-progress-bar', `message-${type}-progress-bar`);
            addClass('.message-progress-bar-fill', `message-${type}-theme`);
            setTimeout(() => {
                addClass('.message-progress-bar-fill', 'message-progress-bar-fill-run');
            }, 50);
            css('.message-progress-bar-fill', {transition: `width ${autoDismissTimeframe}s ease-out`});
            messageTimer = setTimeout(closeMessagePopup, autoDismissTimeframe * 1000);
        }
    }
    addClass('.message-container', 'message-container-show');
    show('.message-mask');
};

const renderAppMenuContent = (hiddenGroups = []) => {
    const container = qs('.app-menu-content');
    html(container, '');
    if (hiddenGroups.length > 0) {  
        let addGroupButton;      
        hiddenGroups.forEach(group => {
            if (html(group) == '+') {
                addGroupButton = create('div', '+ Add Group');
                addGroupButton.addEventListener('click', addGroup);                 
            }
            else {
                const index = attr(group, 'group-index');
                const groupItem = create('div', html(group), '', {'group-index': index});
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
        const settingsItem = create('div', '&#9900; Settings');
        settingsItem.addEventListener('click', showSettingsPanel);    
        container.append(settingsItem);
    }
};

const renderGroups = () => {
    const groups = homeTabData.groups;
    const container = qs('.group-container');
    html(container, '');
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
    html(container, '');
    container.addEventListener('click', closeAppMenu);
    container.parentNode.addEventListener('click', closeAppMenu);
    data.forEach((bookmark, bookmarkIndex) => {
        const bookmarkItem = create('div', '', 'bookmark-item', {
            id: `bookmark${bookmarkIndex}`,
            draggable: true
        });
        bookmarkItem.addEventListener('click', () => {
            closeAppMenu();
            if (forceOpenInNewTab || (typeof openInNewTab !== 'undefined' && openInNewTab)) {
                forceOpenInNewTab = false;
                setTimeout(() => window.open(bookmark.url), 50);
            }
            else top.location.href = bookmark.url;
        });
        bookmarkItem.addEventListener('dragstart', setBookmarkDrag);       
        bookmarkItem.addEventListener('dragend', moveBookmark);         
        bookmarkItem.addEventListener('contextmenu', () => editBookmark(bookmark, bookmarkIndex));
        const bookmarkThumb = create('div', '', 'bookmark-thumbnail');
        const thumbnailSource = bookmark.hasOwnProperty('thumbnail') && bookmark.thumbnail.match(/^(http|https):\/\//i) == null ? `${baseUrl}/thumbnail/${bookmark.thumbnail}` : bookmark.thumbnail;
        setBackground(bookmarkThumb, thumbnailSource);
        const bookmarkLabel = create('div', bookmark.label, 'bookmark-label');
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
    setDataToServer();
};

const closeGroupForm = () => {
    groupForm.reset();
    editingMemo.length = 0;
    hide('.popup-mask', '.group-form', '.delete-group-button-container');
    removeClass('.group-form', 'form-container-show');
};

const showGroupForm = () => {
    closeAppMenu();
    const type = getValue('.group-form-index') == -1 ? 'Add' : 'Edit';
    html('.group-form-header', `${type} Group`);
    html('.group-form-submit-button', type == 'Add' ? 'Add' : 'Save');
    show('.popup-mask');
    setTimeout(() => {
        addClass('.group-form', 'form-container-show');
        groupForm.elements[1].focus();
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
    const startingPoint = attr(sourceObj, 'starting-point');
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
    renderGroups();
    goToGroup(currentGroup);
};

const editGroup = event => {
    const group = event.target;
    const groupIndex = attr(group, 'group-index');
    const groupName = group.innerText;
    setFormValues(groupForm, [
        groupIndex,
        groupName
    ]);
    show('.delete-group-button-container');
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
            else homeTabData.groups[groupIndex].name = groupName;
            renderGroups();
            goToGroup(groupIndex);
            setGruopVisibility();
            closeGroupForm();
        }
        else showMessagePopup(`&#34;${groupName}&#34; already exist, please use another name.`);
    }
    else showMessagePopup('Group Name cannot be empty.');
};

const closeBookmarkForm = () => {
    bookmarkForm.reset();
    editingMemo.length = 0;
    uploadBuffer = undefined;
    enableForm(bookmarkForm, '.close-bookmark-form', '.delete-bookmark-button');
    removeClass('.bookmark-form', 'form-disabled', 'bookmark-form-expand');
    hide('.popup-mask', '.bookmark-form', '.delete-bookmark-button-container');
    removeClass('.bookmark-form', 'form-container-show');
};

const showBookmarkForm = () => {
    closeAppMenu();
    const type = getValue('.bookmark-form-index') == -1 ? 'Add' : 'Edit';
    html('.bookmark-form-header', `${type}  Bookmark`);
    html('.bookmark-form-submit-button', type == 'Add' ? 'Add' : 'Save');
    show('.popup-mask');
    setTimeout(() => {
        addClass('.bookmark-form', 'form-container-show');
        bookmarkForm.elements[1].focus();
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
    const startingPoint = JSON.parse(attr(sourceObj, 'starting-point'));
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
            homeTabData.groups[groupIndex].bookmarks.push({
                label: sourceBookmark.label,
                url: sourceBookmark.url,
                thumbnail: sourceBookmark.thumbnail
            });
            newBookmarks = homeTabData.groups[currentGroup].bookmarks.filter((bookmark, index) => index != sourceIndex);
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
            else dropPointFlatX = (bodyWidth * Math.floor(dropPointY / baseY)) + dropPointX;
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
        renderBookmarks(newBookmarks);
        setDataToServer();
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
        '',
        ''
    ]);
    show('.delete-bookmark-button-container');
    editingMemo.push(bookmarkIndex, bookmarkLabel, bookmarkUrl, bookmarkThumbnail);
    switchThumbnailType();
    showBookmarkForm();
    return false;
};

const addBookmark = () => {
    setValue('.bookmark-form-index', -1);
    qs('#thumbnail_option_favicon').click();
    showBookmarkForm();
};

const initThumbnailUploader = () => {
    setDropArea('thumbnail');
};

const switchThumbnailType = (type = '') => {
    uploadBuffer = undefined;
    if (type == '') {
        hide('.thumbnail-custom-url', '.thumbnail-upload-container');
        removeClass('.bookmark-form', 'bookmark-form-small-expand', 'bookmark-form-full-expand');
    }
    else if (type == 'upload') {
        hide('.thumbnail-custom-url');
        show('.thumbnail-upload-container');
        addClass('.bookmark-form', 'bookmark-form-small-expand');
        addClass('.bookmark-form', 'bookmark-form-full-expand');
        initThumbnailUploader();
    }
    else {
        attr('.thumbnail-custom-url', {placeholder: `Option: Get ${type} from this url instead`});
        hide('.thumbnail-upload-container');
        show('.thumbnail-custom-url');
        removeClass('.bookmark-form', 'bookmark-form-full-expand');
        addClass('.bookmark-form', 'bookmark-form-small-expand');
    }
    setValue('.bookmark-thumbnail-type', type);
}; 

const submitBookmarkForm = () => {
    const currentGroup = homeTabData.current_group;
    const [bookmarkIndex, bookmarkUrl, bookmarkLabel, bookmarkThumbnailType, bookmarkThumbnailCUrl] = getFormValues(bookmarkForm);
    if (bookmarkLabel.trim() !== '' && bookmarkUrl.trim() !== '') {
        if (bookmarkThumbnailType == 'upload' && typeof uploadBuffer !== 'string') {
            showMessagePopup('Please select a file to upload.');
            return false;
        }
        const submitType = bookmarkIndex == -1 ? 'Add' : 'Edit';
        let shouldReloadThumbnail = true;
        if (submitType == 'Edit') {
            const targetDataBlock = homeTabData.groups[currentGroup].bookmarks[bookmarkIndex];
            if (targetDataBlock.url == bookmarkUrl && bookmarkThumbnailType == '') {
                shouldReloadThumbnail = false;
            }
        }
        const updateBookmark = filename => {
            const bookmarks = homeTabData.groups[currentGroup].bookmarks;
            let newIndex;
            if (bookmarkIndex == -1) {
                newIndex = bookmarks.length;
                bookmarks[newIndex] = {};
            }
            else newIndex = bookmarkIndex;
            bookmarks[newIndex].label = bookmarkLabel;
            bookmarks[newIndex].url = bookmarkUrl;
            if (filename) {
                bookmarks[newIndex].thumbnail = filename;
            }
            goToGroup(currentGroup); 
            closeBookmarkForm();
        };
        if (shouldReloadThumbnail) {
            html('.bookmark-form-submit-button', svgSource.loading);
            disableForm(bookmarkForm, '.close-bookmark-form', '.delete-bookmark-button');
            const deleteThumbnail = editingMemo.length > 0 ? editingMemo[3] : '';
            const thumbnailSourceUrl = bookmarkThumbnailType != 'upload' && bookmarkThumbnailCUrl != '' ? bookmarkThumbnailCUrl : bookmarkUrl;
            const formData = new FormData();
            formData.append('url', bookmarkUrl);
            formData.append('thumbnail_type', bookmarkThumbnailType);
            formData.append('thumbnail_url', thumbnailSourceUrl);
            formData.append('thumbnail_delete', deleteThumbnail);
            formData.append('upload_buffer', uploadBuffer);
            fetch(`${baseUrl}/create-thumbnail/`, {
                method: 'POST',
                header: {'Content-Type': 'multipart/form-data'},
                body: formData
            })
            .then(resp => resp.json())
            .then(data => {
                if (data.message) {
                    showMessagePopup(data.message);
                }
                updateBookmark(data.filename);
            });
        }
        else updateBookmark();    
    }
    else showMessagePopup('URL and Label cannot be empty.');
};

const cancelDeleteItem = () => {
    closeMessagePopup();
};

const preceedDeleteItem = () => {
    let currentGroup = homeTabData.current_group;
    const [itemIndex, , , bookmarkThumbnail] = editingMemo;
    const isGroup = editingMemo.length == 2;
    if (isGroup) {
        const groupHolder = homeTabData.groups.filter((group, index) => index != itemIndex);
        homeTabData.groups = groupHolder;
        itemIndex == currentGroup && (currentGroup = 0);
        itemIndex < currentGroup && (currentGroup = currentGroup - 1);
        homeTabData.current_group = currentGroup;
        renderGroups();
        goToGroup(currentGroup);
        closeGroupForm();
        closeMessagePopup();
    }
    else {
        const formData = new FormData();
        formData.append('thumbnail_delete', bookmarkThumbnail);
        fetch(`${baseUrl}/delete-thumbnail/`, {
            method: 'POST',
            header: {'Content-Type': 'multipart/form-data'},
            body: formData
        })               
        .then(resp => {
            if (resp.ok) {
                const bookmarkHolder = homeTabData.groups[currentGroup].bookmarks.filter((bookmark, index) => index != itemIndex);
                homeTabData.groups[currentGroup].bookmarks = bookmarkHolder;
                goToGroup(currentGroup);
                closeBookmarkForm();
                closeMessagePopup();
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
    isGroup && (message += '<br/>This will also remove bookmarks in this group.');
    showMessagePopup(message, 'confirm', {
        confirmed: preceedDeleteItem,
        cancelled: closeMessagePopup
    });
};

const convertSpeedDialsData = (data) => {
    const htbData = {
        current_group: 0,
        groups: []
    };
    const groupMap = [];
    data.groups.forEach(group => {
        const htbGroups = htbData.groups;
        groupMap.push(group.id);
        htbGroups.push({
            name: group.title,
            bookmarks: []
        });
    });
    data.dials.forEach(dial => {
        let groupIndex = 0;
        for (let i = 0; i < groupMap.length; i++) {
            if (groupMap[i] == dial.idgroup) groupIndex = i;
        }
        const bookmarks = htbData.groups[groupIndex].bookmarks;
        bookmarks.length = Math.max(bookmarks.length, dial.position + 1);
        bookmarks[dial.position] = {
            label: dial.title,
            url: dial.url
        };
    });
    htbData.groups.forEach(group => {
        const cleanBookmarks = group.bookmarks.filter(bookmark => bookmark.label != '' && bookmark.url != '');
        group.bookmarks = cleanBookmarks;
    });
    return htbData;
};

const convertBrowserData = (data) => {
    const htbData = {
        current_group: 0,
        groups: [{
                name:"Home",
                bookmarks:[]
            }]
        };
    const groups = htbData.groups;
    const dataLines = Array.from(data.split('\n'));
    let grouplevelMap = [0];
    let currentLevel = 0;
    dataLines.forEach(line => {
        line = line.trim();
        if (line.match(/(<H3)\s/) != null) {
            const folderName = line.split('>')[1].split('<')[0];
            groups.push({
                name: folderName,
                bookmarks: []
            });
            currentLevel++;
            grouplevelMap.push(currentLevel);
        }
        if (line.match(/(<A)\s/) != null) {
            const bookmarkLabel = line.split('>')[1].split('<')[0];
            const bookmarkUrl = line.split('HREF="')[1].split('"')[0];
            const targetIndex = currentLevel == 0 ? 0 : grouplevelMap.lastIndexOf(currentLevel);
            groups[targetIndex].bookmarks.push({
                label: bookmarkLabel,
                url: bookmarkUrl
            });
        }
        if (line.match(/(<\/DL>)/) != null) {
            currentLevel --;
        }
    });
    return htbData;
};

const isHomeTabBookmarkData = data => {
    data = data.hasOwnProperty('home_tab_data') ? data.home_tab_data : data;
    return data.hasOwnProperty('current_group') && data.hasOwnProperty('groups');
};

const isSpeedDialsData = data => {
    return data.hasOwnProperty('dials') && data.hasOwnProperty('groups');
};

const isNetscapeBookmarkData = data => {
    return data.match(/(NETSCAPE-Bookmark-file|<\/DL>|<A HREF)/i) != null;
};

const importData = files => {
    const uploadFile = files[0];    // only handle the first file
    const dataType = uploadFile.type.split('/')[1];
    const reader = new FileReader();
    reader.onload = async event => {
        try {
            const fileContent = event.target.result;
            const importedData = dataType == 'json' ? JSON.parse(fileContent) : fileContent;
            const isNetscapeBookmark = dataType == 'html' && isNetscapeBookmarkData(importedData);
            const isSpeedDials = dataType == 'json' && isSpeedDialsData(importedData);
            const isHomeTabBookmark = dataType == 'json' && isHomeTabBookmarkData(importedData);
            if (isNetscapeBookmark || isSpeedDials || isHomeTabBookmark) {
                homeTabData = isNetscapeBookmark ? convertBrowserData(importedData) :
                    (isSpeedDials ? convertSpeedDialsData(importedData) : importedData.home_tab_data);
                setDataToServer(true);
                renderGroups();
                goToGroup(homeTabData.current_group);
                showMessagePopup('Data import successfully.', 'info');
            }
            else showMessagePopup('Invalid file format.');
        }
        catch (error) {
            showMessagePopup('Error, please try again later.');
        }
    };
    reader.readAsText(uploadFile);
};

const initImportUploader = () => {
    setDropArea('import');
};

const applyBackground = (type = 'apply') => {
    if (type == 'apply' && typeof uploadBuffer !== 'string') {
        showMessagePopup('Please select a file to upload.');
        return false;
    }
    html('#background_action_button', svgSource.loading);
    qs('#background_action_button').disabled = true;
    const formData = new FormData();
    formData.append('home_tab_data', `{"home_tab_data":${JSON.stringify(homeTabData)}}`);
    type == 'apply' && formData.append('upload_buffer', uploadBuffer);
    fetch(`${baseUrl}/set-background/`, {
        method: 'POST',
        header: {'Content-Type': 'multipart/form-data'},
        body: formData
    })
    .then(resp => resp.json())
    .then(data => {
        if (data.hasOwnProperty('home_tab_data')) {
            homeTabData = data.home_tab_data;
            if (homeTabData.hasOwnProperty('background_image')) {
                setBackground(document.body, `${baseUrl}/${homeTabData.background_image}`);
                showMessagePopup(`Background image ${type == 'apply' ? 'applied' : 'removed'}.`, 'info');
                html('#background_action_button', type == 'apply' ? 'Remove' : 'Apply');
                qs('#background_action_button').disabled = false;
                cleanUploadBuffer();
            }
        }
        else showMessagePopup(data.message);
    });
};

const preceedRemoveBackground = () => {
    setBackground('.drop-area-container');
    homeTabData.background_image = '';
    applyBackground('remove');
    closeMessagePopup();
};

const removeBackground = () => {
    showMessagePopup('Do you want to remove background image?', 'confirm', {
        confirmed: preceedRemoveBackground,
        cancelled: closeMessagePopup
    });
};

const applyBackgroundChanges = () => {
    const type = html('#background_action_button');
    type == 'Apply' ? applyBackground() : removeBackground();
}

const previewImage = files => {
    let reader = new FileReader();
    reader.readAsDataURL(files[0]);
    reader.onloadend = () => {
        uploadBuffer = reader.result;
        setBackground('.drop-area-container', reader.result);
    };
};

const copyApiKey = () => {
    navigator.clipboard.writeText(qs('.api-key-field').value);
    showMessagePopup('API Key copied.', 'info');
};

const verifyDrop = files => {
    const acceptedFormat = attr('.drop-area-file-input', 'accept');
    const uploadFile = files[0];
    if (!acceptedFormat.split(',').includes(uploadFile.type)) {
        showMessagePopup('Invalid file format.');
    }
    else {
        const type = attr('.drop-area-file-input', 'upload-type');
        if (type == 'import') {
            importData(files);
        }
        else if (type == 'thumbnail' || type == 'background') {
            previewImage(files);
        }
    }
};

const cleanUploadBuffer = () => {
    dropAreaForm.reset();
    uploadBuffer = undefined;
};

const resetDropArea = () => {
    ['import', 'thumbnail', 'background'].forEach(container => {
        html(`.${container}-upload-container`, '');
    });
    cleanUploadBuffer();
};

const setDropArea = (type) => { // import / thumbnail / background
    resetDropArea();
    const acceptedFormat = type == 'import' ? 'application/json,text/html' : 'image/png,image/jpeg';
    const dropAreaCode = html('.drop-area-mock').replace(/-mock/g, '');
    const targetSelector = `.${type}-upload-container`;
    html(targetSelector, dropAreaCode);
    attr('.drop-area-file-input', {
        accept: acceptedFormat,
        'upload-type': type
    });
    const dropArea = qs('.drop-area-container');
    setBackground('.drop-area-container', type == 'background' ? `${baseUrl}/${homeTabData.background_image}` : '');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropArea.addEventListener(evt, event => {
            event.preventDefault();
            event.stopPropagation();
        });
    });
        
    ['dragenter', 'dragover'].forEach(evt => {
        dropArea.addEventListener(evt, () => {
            addClass('.drop-area-container', 'dragging-in');
        });
    });
        
    ['dragleave', 'drop'].forEach(evt => {
        dropArea.addEventListener(evt, () => {
            removeClass('.drop-area-container', 'dragging-in');
        });
    });
    dropArea.addEventListener('drop', event => {
        const dt = event.dataTransfer;
        const files = dt.files;
        verifyDrop(files);
    }, false);
    closeAppMenu();
    show('.popup-mask');
    show(targetSelector, 'block');
};

const getAPIKey = () => {
    fetch(`${baseUrl}/get-apikey/`)    
    .then(resp => resp.json())
    .then(data => {
        apikey = data.apikey;
        qs('.api-key-field').value = apikey;
    })
    .catch(error => {
        showMessagePopup('Unable to get api key, please try again later.');
    });    
};

const setSettings = (applyToForm = true) => {
    rememberGroupIndex = homeTabData.hasOwnProperty('remember_group_index') ? homeTabData.remember_group_index : true;
    openInNewTab = homeTabData.hasOwnProperty('open_in_new_tab') ? homeTabData.open_in_new_tab : false;
    autoDismissTimeframe = homeTabData.hasOwnProperty('auto_dismiss_timeframe') ? parseInt(homeTabData.auto_dismiss_timeframe) : 3;
    maxBookmarkPerRow = homeTabData.hasOwnProperty('max_bookmark_per_row') ? parseInt(homeTabData.max_bookmark_per_row) : 6;
    const appBackgroundImage = homeTabData.hasOwnProperty('background_image') ? homeTabData.background_image : '';
    appBackgroundImage != '' && setBackground(document.body, `${baseUrl}/${appBackgroundImage}`);
    const colorScheme = homeTabData.hasOwnProperty('color_scheme') ? homeTabData.color_scheme : 'light_dark';
    if (applyToForm) {
        qs('#remember_group_index').checked = rememberGroupIndex;
        qs('#open_in_new_tab').checked = openInNewTab;
        qs('#auto_dismiss_timeframe').value = autoDismissTimeframe;
        qs('#max_bookmark_per_row').value = maxBookmarkPerRow;
        qs(`#color_scheme_${colorScheme}`).checked = true;
    }
    setBookmarkContainer();
};

const saveSettings = (id, value) => {
    if (id.match(/(color_scheme_)/) != null) {
        homeTabData.color_scheme = id.replace(/color_scheme_/, '');
    }
    if (['remember_group_index', 'max_bookmark_per_row', 'open_in_new_tab', 'auto_dismiss_timeframe'].indexOf(id) != -1) {
        homeTabData[id] = value;
    }
    setSettings(false);
    setDataToServer();
};

const registSettingsEvents = () => {
    qs('.close-settings-panel').addEventListener('click', closeSettingsPanel);
    qs('input[type="checkbox"]', true).forEach(obj => {
        obj.addEventListener('click', event => {
            saveSettings(event.target.id, event.target.checked);
        });
    });
    qs('input[type="radio"]', true).forEach(obj => {
        obj.addEventListener('click', event => {
            saveSettings(event.target.id, event.target.checked);
        });
    });
    qs('input[type="number"]', true).forEach(obj => {
        obj.addEventListener('change', event => {
            saveSettings(event.target.id, event.target.value);
        });
    });    
    qs('.settings-button', true).forEach(obj => {
        obj.addEventListener('click', event => {
            switch(event.target.id) {
                case 'export_data':
                    getDataFromServer();
                    break;
                case 'background_action_button':
                    applyBackgroundChanges();
                    break;
                case 'copy-apikey':
                    copyApiKey();
                    break;                  
                default:
                    return false;
            }
        });
    });       
};

const goToSettingSection = section => {
    settingsMenuItem.forEach(item => {
        item == section ? addClass(`.settings-menu-item-${item}`, 'settings-menu-selected') : removeClass(`.settings-menu-item-${item}`, 'settings-menu-selected');
        item == section ? show(`.settings-${item}`, 'block') : hide(`.settings-${item}`);
    });
    ['appearance', 'data-management'].includes(section) && setDropArea(section == 'appearance' ? 'background' : 'import');
    if (section == 'appearance') {
        html('#background_action_button', !homeTabData.background_image || homeTabData.background_image == '' ? 'Apply' : 'Remove');
    }
    if (section == 'api-key' && !apikey) {
        getAPIKey();
    }
    if (section == 'about') {
        html('.app-name', homeTabData.app_name);
        html('.app-version', homeTabData.version);
    }
};

const closeSettingsPanel = () => {
    resetDropArea();
    hide('.popup-mask', '.settings-panel');
};

const showSettingsPanel = () => {
    closeAppMenu();
    show('.popup-mask');
    setTimeout(() => {
        addClass('.settings-panel', 'form-container-show');
    }, 100);
    show('.settings-panel', 'block');
    goToSettingSection(settingsMenuItem[0]);
};

const closeAppMenu = () => {
    if (html('.app-menu-content') != '') {
        attr('.app-menu-content', 'displayed') == 'true' && toggleAppMenu();
    }
};

const toggleAppMenu = () => {
    const menuContentDiv = qs('.app-menu-content');
    if (html(menuContentDiv) == '')  {
        showSettingsPanel();
    }
    else {
        let displayed = attr(menuContentDiv, 'displayed') == 'true';
        displayed ? removeClass('.app-menu-container', 'app-menu-container-show') : addClass('.app-menu-container', 'app-menu-container-show');
        displayed ? removeClass(menuContentDiv, 'app-menu-content-expand') : addClass(menuContentDiv, 'app-menu-content-expand');
        attr(menuContentDiv, {displayed: (!displayed).toString()});
    }
};

const setBookmarkContainer = () => {
    const bookmarkPerRow = Math.min(Math.floor((window.innerWidth + 17) / bookmarkSpace), maxBookmarkPerRow);
    css('.bookmark-container', {maxWidth: `${bookmarkSpace * bookmarkPerRow}px`});
    css('.bookmark-container', {minWidth: `${bookmarkSpace * bookmarkPerRow}px`});
};

const handleKeyPressed = event => {
    if (event.key == 'Escape') {
        if (!['', 'none'].includes(css('.message-mask', 'display'))) {
            closeMessagePopup();
        }
        else {
            if (css('.popup-mask', 'display') != 'none') {
                closeGroupForm();
                closeBookmarkForm();
                closeSettingsPanel();
            }
        } 
        closeAppMenu();
    }
    event.key == 'Shift' && (forceOpenInNewTab = true);
};

const handleKeyReleased = event => {
    event.key == 'Shift' && (forceOpenInNewTab = false); 
};

const renderHTMLElements = () => {
    // thumbnail option buttons
    const buttonContainer = qs('.thumbnail-options');
    ['favicon', 'screenshot', 'upload'].forEach(btn => {
        const div = create('div');
        const opt = create('input', '', '', {
            type: 'radio',
            name: 'thumbnail_options',
            id: `thumbnail_option_${btn}`
        });
        const label = create('label', `${btn.charAt(0).toUpperCase()}${btn.slice(1)}`, '', {
            for: `thumbnail_option_${btn}`
        });
        opt.addEventListener('click', (event) => {
            switchThumbnailType(btn);
        });
        div.append(opt, label);
        buttonContainer.append(div);
    });
    // delete button
    ['bookmark', 'group'].forEach(item => {
        html(qs(`.delete-${item}-button`), `${svgSource.delete}<span>Delete ${item}</span>`);
    });
};

const registElementPbjects = () => {
    [groupForm, bookmarkForm, dropAreaForm] = document.forms;
};

const registEvents = () => {
    // regist document events
    ['contextmenu', 'dragover', 'dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => document.addEventListener(evt, event => event.preventDefault()));
    document.addEventListener('keydown', handleKeyPressed);
    document.addEventListener('scroll', closeAppMenu);
    document.addEventListener('visibilitychange', () => {forceOpenInNewTab = false});
    // regist html elemet event
    registSettingsEvents();
    groupForm.addEventListener('submit', event => {
        event.preventDefault();
        submitGroupForm();
    });
    bookmarkForm.addEventListener('submit', event => {
        event.preventDefault();
        submitBookmarkForm();
    });
    qs('.app-menu-icon').addEventListener('click', toggleAppMenu);
    settingsMenuItem.forEach(item => {
        qs(`.settings-menu-item-${item}`).addEventListener('click', () => {
            goToSettingSection(item);
        });
    });
    qs('.delete-button', true).forEach(icon => icon.addEventListener('click', deleteItem));
    qs('.close-group-form').addEventListener('click', event => {
        event.preventDefault();
        closeGroupForm();
    });
    qs('.close-bookmark-form').addEventListener('click', event => {
        event.preventDefault();
        closeBookmarkForm();
    });
    qs('.drop-area-file-input').addEventListener('change', event => verifyDrop(event.target.files));
    // regist window event   
    window.addEventListener('resize', () => {
        setGruopVisibility();
        setBookmarkContainer();
    });
};

const setBookmarkSpace = () => {
    const bookmarkObj = qs('.bookmark-item', true).length > 1 ? qs('#bookmark0') : qs('.add-new-bookmark');
    const bookmarkSpec = getComputedStyle(bookmarkObj);
    const bookmarkWidth = parseInt(bookmarkSpec.width);
    const bookmarkMargin = parseInt(bookmarkSpec.margin);
    const bookmarkBorder = parseInt(bookmarkSpec.border);
    bookmarkSpace = bookmarkWidth + ((bookmarkMargin + bookmarkBorder) * 2);
};

const doneInit = () => {
    setSettings();
    renderGroups();
    goToGroup(rememberGroupIndex ? homeTabData.current_group : 0);
    setBookmarkSpace();
    renderHTMLElements();
    registElementPbjects();
    registEvents();
    setGruopVisibility();
    setBookmarkContainer();
};

const svgSource = {
    loading: '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="30" viewBox="0 0 120 108" preserveAspectRatio="xMidYMid" style="background:0 0" display="block"><circle stroke-dasharray="164.934 56.978" r="35" stroke-width="10" stroke="#fff" fill="none" cy="50" cx="50"><animateTransform keyTimes="0;1" values="0 50 50;360 50 50" dur="1s" repeatCount="indefinite" type="rotate" attributeName="transform"/></circle></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 37.5 37.5" version="1.0"><defs><clipPath id="prefix__a"><path d="M0 0h37.008v37.008H0zm0 0"/></clipPath><clipPath id="prefix__b"><path d="M18.504 0C8.285 0 0 8.285 0 18.504c0 10.219 8.285 18.504 18.504 18.504 10.219 0 18.504-8.285 18.504-18.504C37.008 8.285 28.723 0 18.504 0zm0 0"/></clipPath></defs><g clip-path="url(#prefix__a)"><g clip-path="url(#prefix__b)"><path fill="none" d="M18.504 0C8.285 0 0 8.285 0 18.504c0 10.219 8.285 18.504 18.504 18.504 10.219 0 18.504-8.285 18.504-18.504C37.008 8.285 28.723 0 18.504 0zm0 0" stroke="#fff" stroke-width="2.96052"/></g></g><path d="M21.351 9.372c0 .824-.25 1.476-.75 1.953-.5.48-1.168.719-2 .719-.812 0-1.465-.239-1.953-.72-.48-.476-.719-1.128-.719-1.952 0-.79.25-1.43.75-1.922.5-.489 1.16-.735 1.985-.735.812 0 1.46.246 1.953.735.488.492.734 1.133.734 1.922zm-.531 17.015c0 .543.133.934.406 1.172.27.242.692.36 1.266.36 0 .585-.219 1.093-.656 1.53h-6.422c-.43-.437-.64-.945-.64-1.53.562 0 .968-.118 1.218-.36.258-.238.39-.64.39-1.203v-8.234c0-.532-.132-.907-.39-1.125-.25-.227-.746-.344-1.485-.344v-1.25c.457-.29 1.227-.594 2.313-.906 1.094-.313 2.016-.47 2.766-.47.437 0 .75.106.937.313.195.2.297.532.297 1zm0 0" fill="#fff"/></svg>',
    confirm: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 37.5 37.5" version="1.0"><defs><clipPath id="prefix__a"><path d="M0 0h37.008v37.008H0zm0 0"/></clipPath><clipPath id="prefix__b"><path d="M18.504 0C8.285 0 0 8.285 0 18.504c0 10.219 8.285 18.504 18.504 18.504 10.219 0 18.504-8.285 18.504-18.504C37.008 8.285 28.723 0 18.504 0zm0 0"/></clipPath></defs><g clip-path="url(#prefix__a)"><g clip-path="url(#prefix__b)"><path fill="none" d="M18.504 0C8.285 0 0 8.285 0 18.504c0 10.219 8.285 18.504 18.504 18.504 10.219 0 18.504-8.285 18.504-18.504C37.008 8.285 28.723 0 18.504 0zm0 0" stroke="#fff" stroke-width="2.96052"/></g></g><path d="M11.903 14.834c.22-1.875.907-3.32 2.063-4.343 1.164-1.02 2.676-1.532 4.531-1.532 1.906 0 3.469.528 4.688 1.579 1.226 1.054 1.843 2.37 1.843 3.953 0 .793-.183 1.562-.546 2.312-.356.75-1.196 1.715-2.516 2.89-1.024.907-1.668 1.622-1.938 2.141-.261.524-.402 1.461-.421 2.813h-2.391c0-1.07.035-1.852.11-2.344.081-.5.241-.984.484-1.453.25-.477.57-.926.968-1.344.395-.414.946-.93 1.657-1.547.906-.8 1.468-1.43 1.687-1.89a3.11 3.11 0 00.344-1.39c0-.97-.387-1.821-1.156-2.563-.762-.739-1.688-1.11-2.782-1.11-2.242 0-3.59 1.371-4.046 4.11zm7.985 14.797H17.06v-2.843h2.828zm0 0" fill="#fff"/></svg>',
    alert: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 37.5 37.5" version="1.0"><defs><clipPath id="prefix__a"><path d="M.035 2.242H37V34.81H.035zm0 0"/></clipPath></defs><g clip-path="url(#prefix__a)"><path fill="#fff" d="M18.54 27.277a2.046 2.046 0 00-1.438.598c-.192.191-.34.414-.442.664-.105.25-.156.508-.156.777 0 .274.05.532.156.782.102.25.25.468.442.66.191.191.414.34.66.441.25.106.511.156.781.156s.531-.05.781-.156c.25-.101.469-.25.66-.441.192-.192.34-.41.442-.66.105-.25.156-.512.156-.782s-.055-.53-.156-.78a2.04 2.04 0 00-1.887-1.259zm.062-16.644h-.122c-.304 0-.597.058-.875.18a2.202 2.202 0 00-1.207 1.273 2.208 2.208 0 00-.132.887l.68 12.363a1.53 1.53 0 00.476 1.027 1.517 1.517 0 001.05.422h.133a1.554 1.554 0 001.055-.422 1.53 1.53 0 00.477-1.027l.68-12.363a2.278 2.278 0 00-.133-.887 2.269 2.269 0 00-.473-.762 2.242 2.242 0 00-.734-.511 2.18 2.18 0 00-.875-.18zm16.96 22.246a1.28 1.28 0 01-.503.516 1.312 1.312 0 01-.696.18H2.723c-.54 0-.938-.231-1.207-.696-.266-.465-.266-.926.004-1.39l15.816-27.4c.27-.464.668-.698 1.207-.698.535 0 .937.234 1.203.699l15.817 27.398c.132.215.195.446.195.696 0 .25-.063.48-.196.695zM20.739 3.516l15.82 27.398c.227.395.34.816.34 1.27 0 .453-.113.875-.34 1.27a2.517 2.517 0 01-2.195 1.269H2.723c-.453 0-.88-.114-1.27-.34a2.47 2.47 0 01-.93-.93 2.494 2.494 0 01-.34-1.27c0-.453.114-.874.34-1.269l15.82-27.398c.114-.196.247-.368.403-.528a2.61 2.61 0 011.137-.656c.215-.059.433-.086.656-.086a2.51 2.51 0 011.27.34c.195.113.367.246.527.402.156.16.289.332.402.528zm0 0" fill-rule="evenodd"/></g></svg>',
    delete: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="64 0 208 256" overflow="visible"><path d="M128 21.333c-17.578 0-32 14.422-32 32H40a8 8 0 100 16h13.333v136c0 16.176 13.158 29.334 29.334 29.334h54.041a69.437 69.437 0 01-11.51-16H82.667c-7.35 0-13.334-5.984-13.334-13.334v-136h117.334v48c5.514 0 10.853.711 16 1.927V69.333H216a8 8 0 100-16h-56c0-17.578-14.422-32-32-32zm0 16c8.929 0 16 7.072 16 16h-32c0-8.928 7.071-16 16-16zm-18.792 58.552a8 8 0 00-7.875 8.115v80a8 8 0 1016 0v-80a8 8 0 00-8.125-8.115zm37.459.115c-4.422 0-8 3.579-8 8v32.708a69.437 69.437 0 0116-11.51V104c0-4.421-3.58-8-8-8zm40 32c-32.4 0-58.667 26.267-58.667 58.667 0 32.4 26.267 58.666 58.667 58.666 32.4 0 58.666-26.266 58.666-58.666S219.067 128 186.667 128zM160 154.667c1.364 0 2.728.52 3.77 1.562l22.897 22.896 22.895-22.896a5.328 5.328 0 017.542 0 5.328 5.328 0 010 7.542l-22.896 22.896 22.896 22.895a5.328 5.328 0 010 7.542 5.319 5.319 0 01-3.77 1.563 5.319 5.319 0 01-3.772-1.563l-22.895-22.896-22.896 22.896a5.319 5.319 0 01-3.771 1.563 5.319 5.319 0 01-3.77-1.563 5.328 5.328 0 010-7.542l22.895-22.895-22.896-22.896a5.328 5.328 0 010-7.542 5.315 5.315 0 013.77-1.562z" fill="#bb2d3b" stroke-miterlimit="10" font-family="none" font-weight="none" font-size="none" text-anchor="none"/></svg>'
};

// document.addEventListener('DOMContentLoaded', getDataFromServer);
getDataFromServer(true);