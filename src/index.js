const appName = 'Home Tab Bookmark';
const version = '1.0.0';
const express = require('express');
const cors = require('cors');
const formidable = require('express-formidable');
const url = require('url');
const path = require('path');
const fs = require('fs');
const {createThumbnail, saveBackgroundImage} = require('./modules/thumbnail-factory');

// Available ENV
const port = process.env.PORT || 3000;
const screenshotAPI = process.env.SCREENSHOT_API || 'false';
const enableBasicAuth = process.env.BASIC_AUTH || 'disabled'; // disabled, always, whitelist
const authWhiteList = process.env.BASIC_AUTH_WHITE_LIST ? `${process.env.BASIC_AUTH_WHITE_LIST},localhost:${port}` : `localhost:${port}`;
const username = process.env.USER_NAME || 'admin';
const password = process.env.PASSWORD || 'admin';

const dataRoot = path.join(__dirname, '/data');
const dataFile = `${dataRoot}/home-tab-bookmark-data.json`;
const apiKeyFile = `${dataRoot}/key`;
const thumbnailDir = `${dataRoot}/thumbnail`;
const backgroundDir = `${dataRoot}/background`;
const recycleBin = `${dataRoot}/.recycle`;

const authentication = (request, response, next) => {
    let preceedBasicAuth = true;
    if (enableBasicAuth == 'disabled'){
        preceedBasicAuth = false;
    }
    else if (enableBasicAuth == 'whitelist') {
        const hostName = request.get('host');
        const whiteList = authWhiteList.split(',');
        for (let i = 0; i < whiteList.length; i++) {
            if (whiteList[i].trim().toLowerCase() == hostName.toLowerCase()) {
                preceedBasicAuth = false;
                break;
            }
        }
    }
    if (!preceedBasicAuth) {
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

const recycleOldThumbnail = filename => {
    !fs.existsSync(recycleBin) && fs.mkdirSync(recycleBin);
    fs.existsSync(`${thumbnailDir}/${filename}`) && fs.renameSync(`${thumbnailDir}/${filename}`, `${recycleBin}/${filename}`);
};

const createAPIKey = () => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let token = '';
    while (token.length < 40) {
        token = `${token}${chars.charAt(Math.floor(Math.random() * (chars.length + 1)))}`;
    }
    return token;
};

const readAPIKey = () => {
    const apikey = fs.readFileSync(apiKeyFile, {encoding: 'utf8', flag: 'r'});
    // console.log('read=' + apikey);
    return apikey;
}

const app = express();
app.set('view engine', 'ejs');
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(formidable());

app.get('/api/group', async (request, response) => {
    if (request.query.apikey == readAPIKey()) {
        const data = fs.readFileSync(dataFile);
        const dataObj = JSON.parse(data);
        const groups = [];
        dataObj.home_tab_data.groups.forEach(group => groups.push(group.name));
        response.set('Content-Type', 'text/json').status(200).send({"groups": groups});
    }
    else {
        response.set('Content-Type', 'text/json').status(400).send({"error": "Invalid api key."});
    }
});

app.get('/api/add/group', async (request, response) => {
    if (request.query.apikey == readAPIKey()) {
        const data = fs.readFileSync(dataFile);
        const dataObj = JSON.parse(data);
        dataObj.home_tab_data.groups.push({
            name: request.query.name,
            bookmarks: []
        });
        const groups = [];
        dataObj.home_tab_data.groups.forEach(group => groups.push(group.name));
        fs.writeFileSync(dataFile, JSON.stringify(dataObj));
        response.set('Content-Type', 'text/json').status(200).send({"groups": groups});
    }
    else {
        response.set('Content-Type', 'text/json').status(400).send({"error": "Invalid api key."});
    }
});

app.get('/api/add/bookmark', async (request, response) => {
    if (request.query.apikey == readAPIKey()) {
        const data = fs.readFileSync(dataFile);
        const dataObj = JSON.parse(data);
        const groups = dataObj.home_tab_data.groups;
        for (let i = 0; i < groups.length; i++) {
            if (groups[i].name == request.query.group) {
                groups[i].bookmarks.push({
                    url: request.query.url,
                    label: request.query.title
                });
                break;
            }
        }
        fs.writeFileSync(dataFile, JSON.stringify(dataObj));
        response.set('Content-Type', 'text/json').status(200).send({"result": "Succeed"});
    }
    else {
        response.set('Content-Type', 'text/json').status(400).send({"error": "Invalid api key."});
    }    
});

app.use(authentication);
app.use(express.static(path.join(__dirname, '/public')));
app.use('/thumbnail',  express.static(thumbnailDir));
app.use('/background',  express.static(backgroundDir));

app.get('/script.js', (request, response) => {
    const vars = {
        appName: appName,
        version: version
    };
    response.render(path.join(__dirname, '/views/script'), vars);
});

app.post('/process', async (request, response) => {
    const req = request.fields;
    const action = req.action;
    if (action == 'create-thumbnail') {
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
            response.set('Content-Type', 'text/json').status(result.status).send(result);
        })
        .catch(error => {
            console.log(`create-thumbnail error > ${error.message}`);
            response.set('Content-Type', 'text/plain').status(500).send('Error, unable to create thumbnail.');
        });
    }
    else if (action == 'set-background') {
        const data = JSON.parse(req.home_tab_data);
        !fs.existsSync(backgroundDir) && fs.mkdirSync(backgroundDir);
        const files = fs.readdirSync(backgroundDir);
        for (const file of files) {
            const filePath = path.join(backgroundDir, file);
            fs.unlinkSync(filePath);
        }
        try {
            let result = {status: 200};
            if (req.upload_buffer) {
                await saveBackgroundImage({
                    dir: backgroundDir,
                    buffer: req.upload_buffer
                });
            }
            if (result.filepath) {
                data.home_tab_data.background_image = result.filepath;
            }
            fs.writeFileSync(dataFile, JSON.stringify(data));
            response.set('Content-Type', 'text/json').status(result.status).send(data);
        }
        catch (error) {
            console.log(`set-background error > ${error.message}`);
            response.set('Content-Type', 'text/plain').status(500).send('Error, unable to set background.');
        }
    }
    else if (action == 'delete-bookmark') {
        try {
            recycleOldThumbnail(req.thumbnail_delete);
            response.set('Content-Type', 'text/plain').status(200).send(req.thumbnail_delete);
        }
        catch (error) {
            console.log(`delete-bookmark error > ${error.message}`);
            response.set('Content-Type', 'text/plain').status(200).send(req.thumbnail_delete);
        }
    }
    else if (action == 'get-data') {
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
                response.set('Content-Type', 'text/json').status(200).send(data);
            });
        }
        else {
            const dataSchema = `{"home_tab_data":{"current_group":0,"groups":[{"name":"Home","bookmarks":[]}],"version":"${version}","timestamp":${Date.now()}}}`;
            fs.writeFile(dataFile, dataSchema, error => {
                response.set('Content-Type', 'text/json').status(200).send(dataSchema);
            });
        }
    }    
    else if (action == 'set-data') {
        try {
            fs.writeFileSync(dataFile, req.home_tab_data);
            // fs.existsSync(recycleBin) && fs.rmSync(recycleBin, {recursive: true, force: true});
            response.set('content-type', 'text/json').status(200).send(req.home_tab_data);
        }
        catch (error) {
            console.log(`set-data error > ${error.message}`);
            response.status(500).send('Error, unable to save data.');
        }
    }
    else if (action == 'get-api-key') {
        let apikey;
        try {
            if (fs.existsSync(apiKeyFile)) {
                apikey = readAPIKey();
            }
            else {
                apikey = createAPIKey();
                fs.writeFileSync(apiKeyFile, apikey);
            }
            response.set('content-type', 'text/json').status(200).send({apikey: apikey});
        }
        catch (error) {
            console.log(`create-api-key error > ${error.message}`);
            response.set('content-type', 'text/plain').status(500).send('Error, unable to create api key.');
        }
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});