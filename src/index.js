const appName = 'Home Tab Bookmark';
const version = '1.0.0';
const express = require('express');
const formidable = require('express-formidable');
const url = require('url');
const path = require('path');
const fs = require('fs');
const {createThumbnail, saveBackgroundImage} = require('./modules/thumbnail-factory');

// Available ENV
const screenshotAPI = process.env.SCREENSHOT_API || 'false';
const maxBookmarkPerRow = process.env.MAX_BOOKMARK_PER_ROW || 6;
const openInNewTab = process.env.OPEN_IN_NEW_TAB || 'false';
const enableBasicAuth = process.env.BASIC_AUTH || 'false';
const username = process.env.USER_NAME || 'admin';
const password = process.env.PASSWORD || 'admin';
const port = process.env.PORT || 3000;

const dataRoot = path.join(__dirname, '/data');
const dataFile = `${dataRoot}/home-tab-bookmark-data.json`;
const thumbnailDir = `${dataRoot}/thumbnail`;
const backgroundDir = `${dataRoot}/background`;
const recycleBin = `${dataRoot}/.recycle`;

const authentication = (request, response, next) => {
    if (enableBasicAuth == 'false') {
        next();
    }
    else {
        const authheader = request.headers.authorization;
        if (!authheader) {
            const error = new Error('You are not authenticated!');
            response.set('WWW-Authenticate', 'Basic').status(401).send(error.message);
            return next(error);          
        }
        const auth = new Buffer.from(authheader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];
        if (user == username && pass == password) {
            next();
        } else {
            const error = new Error('You are not authenticated!');
            response.set('WWW-Authenticate', 'Basic').status(401).send(error.message);
            return next(error);            
        }
    }
};

const parseUrlParts = address => {
    return url.parse(address, true);
};

const getThumbnailProperties = (bookmarkUrl, thumbnailType, thumbnailUrl) => {
    const urlParts = parseUrlParts(bookmarkUrl);
    const prefix = urlParts.hostname;
    !fs.existsSync(thumbnailDir) && fs.mkdirSync(thumbnailDir);
    const originUrl = prefix;
    const destName = `${prefix}-${Date.now()}.png`;
    const destPath = `${thumbnailDir}/${destName}`;
    return {originUrl, thumbnailType, thumbnailUrl, destName, destPath, screenshotAPI};
};

const recycleOldThumbnail = (filename) => {
    !fs.existsSync(recycleBin) && fs.mkdirSync(recycleBin);
    fs.existsSync(`${thumbnailDir}/${filename}`) && fs.renameSync(`${thumbnailDir}/${filename}`, `${recycleBin}/${filename}`);
};

const app = express();
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(formidable());
app.use(authentication);
app.use(express.static(path.join(__dirname, '/public')));
app.use('/thumbnail',  express.static(thumbnailDir));
app.use('/background',  express.static(backgroundDir));

app.get('/script.js', (request, response) => {
    const vars = {
        appName: appName,
        version: version,
        maxBookmarkPerRow: isNaN(parseInt(maxBookmarkPerRow)) ? 6 : parseInt(maxBookmarkPerRow),
        openInNewTab: openInNewTab == 'true' ? 1 : 0
    };
    response.render(path.join(__dirname, '/views/script'), vars);
});

app.post('/process', async (request, response) => {
    const req = request.fields;
    const action = req.action;
    if (action == 'thumbnail') {
        !fs.existsSync(thumbnailDir) && fs.mkdirSync(thumbnailDir);
        const bookmarkUrl = req.url;
        const thumbnailType = req.thumbnail_type ? req.thumbnail_type : 'favicon';
        const thumbnailUrl = req.thumbnail_url && req.thumbnail_url != ''? req.thumbnail_url : bookmarkUrl;
        const fileProps = getThumbnailProperties(bookmarkUrl, thumbnailType, thumbnailUrl);
        if (thumbnailType == 'upload' && req.upload_buffer) {
            fileProps.uploadBuffer = req.upload_buffer;
        }
        await createThumbnail(fileProps)
        .then(result => {
            if (result.status == 200 && req.thumbnail_delete) {
                recycleOldThumbnail(req.thumbnail_delete);
            }
            response.set('Content-Type', 'text/plain').status(result.status).send(JSON.stringify(result));
        })
        .catch(error => {
            console.log(error.message);
            response.status(500).send(error.message);
        });
    }
    else if (action == 'background') {
        !fs.existsSync(backgroundDir) && fs.mkdirSync(backgroundDir);
        const files = fs.readdirSync(backgroundDir);
        for (const file of files) {
            const filePath = path.join(backgroundDir, file);
            fs.unlinkSync(filePath);
        }
        await saveBackgroundImage({
            dir: backgroundDir,
            buffer: req.upload_buffer
        })
        .then(result => {
            response.set('Content-Type', 'text/plain').status(result.status).send(JSON.stringify(result));
        })
        .catch(error => {
            console.log(error.message);
            response.status(500).send(error.message);
        });
    }
    else if (action == 'delete') {
        try {
            recycleOldThumbnail(req.thumbnail_delete);
            response.set('Content-Type', 'text/plain').status(200).send(req.thumbnail_delete);
        }
        catch (error) {
            console.log(error.message);
            response.status(500).send(error.message);
        }
    }
    else if (action == 'restore') {
        if (fs.existsSync(dataFile)) {
            fs.readFile(dataFile, async (error, data) => {
                const dataObj = JSON.parse(data);
                await dataObj.home_tab_data.groups.forEach(group => {
                    group.bookmarks.forEach(bookmark => {
                        const filename = bookmark.thumbnail;
                        if (!fs.existsSync(`${thumbnailDir}/${filename}`)) {
                            fs.existsSync(`${recycleBin}/${filename}`) && fs.renameSync(`${recycleBin}/${filename}`, `${thumbnailDir}/${filename}`);
                        }
                    })
                });
                response.set('Content-Type', 'text/plain').status(200).send(data);
            });
        }
        else {
            const dataSchema = `{"home_tab_data":{"current_group":0,"groups":[{"name":"Home","bookmarks":[]}],"version":"${version}","timestamp":${Date.now()}}}`;
            fs.writeFile(dataFile, dataSchema, error => {
                response.set('Content-Type', 'text/plain').status(200).send(dataSchema);
            });
        }
    }    
    else if (action == 'commit') {
        try {
            fs.writeFileSync(dataFile, req.home_tab_data);
            fs.existsSync(recycleBin) && fs.rmSync(recycleBin, {recursive: true, force: true});
            response.set('content-type', 'text/plain').status(200).send(JSON.stringify(req.home_tab_data)); 
        }
        catch (error) {
            response.status(500).send('Error, Data commit error.');
        }
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});