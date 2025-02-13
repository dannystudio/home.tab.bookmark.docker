const appName = 'Home Tab Bookmark';
const version = '1.0.0';
const express = require('express');
const formidable = require('express-formidable');
const url = require('url');
const fs = require('fs');
const tf = require('./thumbnail-factory');

// Available ENV
const screenshotAPI = process.env.SCREENSHOT_API || 'false';
const maxBookmarkPerRow = process.env.MAX_BOOKMARK_PER_ROW || 6;
const openInNewTab = process.env.OPEN_IN_NEW_TAB || 'false';
const enableBasicAuth = process.env.BASIC_AUTH || 'false';
const username = process.env.USER_NAME || 'admin';
const password = process.env.PASSWORD || 'admin';
const port = process.env.PORT || 3000;

const dataFile = './data/home-tab-bookmark-data.json';
const thumbnailDir = './data/thumbnail';
const recycleBin = './data/.recycle';

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

const getThumbnailProperties = (thumbnailUrl, thumbnailType, screenshotAPI, bookmarkUrl) => {
    const urlParts = parseUrlParts(bookmarkUrl);
    const prefix = urlParts.hostname;
    !fs.existsSync(thumbnailDir) && fs.mkdirSync(thumbnailDir);
    const originName = `${prefix}-${Date.now()}_origin.png`;
    const originPath = `${thumbnailDir}/${originName}`;
    const destName = `${prefix}-${Date.now()}.png`;
    const destPath = `${thumbnailDir}/${destName}`;
    return {thumbnailType, thumbnailUrl, originName, originPath, destName, destPath, screenshotAPI};
};

const recycleOldThumbnail = (filename) => {
    !fs.existsSync(recycleBin) && fs.mkdirSync(recycleBin);
    fs.existsSync(`${thumbnailDir}/${filename}`) && fs.renameSync(`${thumbnailDir}/${filename}`, `${recycleBin}/${filename}`);
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(formidable());
app.use(authentication);
app.use(express.static('public'));
app.use('/thumbnail',  express.static(thumbnailDir));

app.get('/script.js', (request, response) => {
    const filePath = './private/script.js';
    fs.readFile(filePath, 'utf8', (error, originCode) => {
        if (error) {
            console.error(error.message);
            return response.status(500).send('Error reading file.');
        }
        let appVariables = `const appName='${appName}',version='${version}'`;
        let envVariables = '';
        ((screenshotAPI != 'false' && screenshotAPI != 'none') || tf.usePuppeteer) && (envVariables += ',hasScreenshotAPI=true');
        isNaN(parseInt(maxBookmarkPerRow)) ? 6 : parseInt(maxBookmarkPerRow);
        envVariables += `,maxBookmarkPerRow=${maxBookmarkPerRow}`;
        openInNewTab != 'false' && (envVariables += ',openInNewTab=true');
        const appendedCode = `${appVariables}${envVariables};${originCode}`;
        response.set('Content-Type', 'text/javascript').send(appendedCode);
    });
});

app.post('/process', async (request, response) => {
    const req = request.fields;
    const action = req.action;
    if (action == 'thumbnail') {
        !fs.existsSync(thumbnailDir) && fs.mkdirSync(thumbnailDir);
        const bookmarkUrl = req.url;
        const thumbnailType = req.thumbnail_type ? req.thumbnail_type : 'favicon';
        const thumbnailUrl = req.thumbnail_url && req.thumbnail_url != ''? req.thumbnail_url : bookmarkUrl;
        const fileProps = getThumbnailProperties(thumbnailUrl, thumbnailType, screenshotAPI, bookmarkUrl);
        if (thumbnailType == 'upload' && req.upload_buffer) {
            fileProps.uploadBuffer = req.upload_buffer;
        }
        await tf.createThumbnail(fileProps)
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
    else if (action == 'backup') {
        fs.writeFile(dataFile, req.home_tab_data, error => {
            error ?
            response.status(500).send('Error, Data Writing Error.') :
            response.set('content-type', 'text/plain').status(200).send(JSON.stringify(req.home_tab_data));
        });       
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});