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
const screenshotAPI = process.env.SCREENSHOT_API || '';
const enableBasicAuth = process.env.BASIC_AUTH || 'disabled'; // disabled, always, whitelist
const authWhiteList = process.env.BASIC_AUTH_WHITE_LIST ? `${process.env.BASIC_AUTH_WHITE_LIST},localhost:${port}` : `localhost:${port}`;
const username = process.env.USER_NAME || 'admin';
const password = process.env.PASSWORD || 'admin';

const dataRoot = path.join(__dirname, '/data');
const dataFile = `${dataRoot}/home-tab-bookmark-data.json`;
const apiKeyFile = `${dataRoot}/key`;
const thumbnailDir = `${dataRoot}/thumbnail`;
const backgroundDir = `${dataRoot}/background`;

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
    const unAuthenticated = () => {
        const error = new Error('You are not authenticated!');
        response.set('WWW-Authenticate', 'Basic').status(401).send(error.message);
        return next(error);
    }
    if (!preceedBasicAuth) {
        next();
    }
    else {
        const authheader = request.headers.authorization;
        if (!authheader) {
            return unAuthenticated();
        }
        const auth = new Buffer.from(authheader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];
        if (user == username && pass == password) {
            next();
        } else {
            return unAuthenticated();
        }
    }
};

const getThumbnailProperties = (bookmarkUrl, thumbnailType, thumbnailUrl) => {
    const urlParts = url.parse(bookmarkUrl, true);
    const prefix = urlParts.hostname;
    !fs.existsSync(thumbnailDir) && fs.mkdirSync(thumbnailDir);
    const originUrl = prefix;
    const destName = `${prefix}-${Date.now()}.png`;
    const destPath = `${thumbnailDir}/${destName}`;
    return {originUrl, thumbnailType, thumbnailUrl, destName, destPath, screenshotAPI};
};

const deleteThumbnail = filename => {
    fs.existsSync(`${thumbnailDir}/${filename}`) && fs.rmSync(`${thumbnailDir}/${filename}`);
};

const createAPIKey = (len = 40) => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let token = '';
    while (token.length < len) {
        token = `${token}${chars.charAt(Math.floor(Math.random() * (chars.length + 1)))}`;
    }
    return token;
};

const readAPIKey = () => {
    const apikey = fs.readFileSync(apiKeyFile, {encoding: 'utf8', flag: 'r'});
    return apikey;
}

const app = express();
app.set('view engine', 'ejs');
app.use(cors());
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
    else response.set('Content-Type', 'text/json').status(401).send({"message":"Invalid api key."});
});

app.get('/api/add/bookmark', async (request, response) => {
    if (request.query.apikey == readAPIKey()) {
        const bookmarkUrl = request.query.url;
        const thumbnailType = 'favicon';
        const fileProps = getThumbnailProperties(bookmarkUrl, thumbnailType, bookmarkUrl);
        await createThumbnail(fileProps)
        .then(result => {
            const data = fs.readFileSync(dataFile);
            const dataObj = JSON.parse(data);
            const groups = dataObj.home_tab_data.groups;
            for (let i = 0; i < groups.length; i++) {
                if (groups[i].name == request.query.group) {
                    groups[i].bookmarks.push({
                        url: request.query.url,
                        label: request.query.title,
                        thumbnail: fileProps.destName
                    });
                    break;
                }
            }
            fs.writeFileSync(dataFile, JSON.stringify(dataObj));
            response.set('Content-Type', 'text/json').status(result.status).send(result);
        })
        .catch(error => {
            console.log(`api create thumbnail error: ${error.message}`);
            response.set('Content-Type', 'text/json').status(500).send({"message":"Error, unable to create thumbnail."});
        });
    }
    else response.set('Content-Type', 'text/json').status(401).send({"message":"Invalid api key."});
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

app.post('/create-thumbnail', async (request, response) => {
    const req = request.fields;
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
            deleteThumbnail(req.thumbnail_delete);
        }
        response.set('Content-Type', 'text/json').status(result.status).send(result);
    })
    .catch(error => {
        console.log(`create-thumbnail error > ${error.message}`);
        response.set('Content-Type', 'text/plain').status(500).send('Error, unable to create thumbnail.');
    });    
});

app.post('/set-background', async (request, response) => {
    const req = request.fields;
    const data = JSON.parse(req.home_tab_data);
    fs.rmSync(backgroundDir, {recursive: true, force: true});
    fs.mkdirSync(backgroundDir);
    try {
        let result = {status: 200};
        if (req.upload_buffer) {
            result = await saveBackgroundImage({
                dir: backgroundDir,
                buffer: req.upload_buffer
            });
            if (result.filepath) {
                data.home_tab_data.background_image = result.filepath;
            }
        }
        else data.home_tab_data.background_image = '';
        fs.writeFileSync(dataFile, JSON.stringify(data));
        response.set('Content-Type', 'text/json').status(result.status).send(result.status == 200 ? data : result);
    }
    catch (error) {
        console.log(`set-background error > ${error.message}`);
        response.set('Content-Type', 'text/json').status(500).send({message:`Error, unable to ${req.upload_buffer ? 'set' : 'remove'} background.`});
    }   
});

app.post('/delete-thumbnail', async (request, response) => {
    const req = request.fields;
    try {
        deleteThumbnail(req.thumbnail_delete);
        response.set('Content-Type', 'text/plain').status(200).send(req.thumbnail_delete);
    }
    catch (error) {
        console.log(`delete-thumbnail error > ${error.message}`);
        response.set('Content-Type', 'text/plain').status(200).send(req.thumbnail_delete);
    }  
});

app.post('/set-data', async (request, response) => {
    const req = request.fields;
    try {
        fs.writeFileSync(dataFile, req.home_tab_data);
        response.set('content-type', 'text/json').status(200).send(req.home_tab_data);
    }
    catch (error) {
        console.log(`set-data error > ${error.message}`);
        response.status(500).send('Error, unable to save data.');
    }
});

app.get('/get-data', async (request, response) => {
    const referer = request.get('referer');
    if (referer) {
        if (fs.existsSync(dataFile)) {
            fs.readFile(dataFile, async (error, data) => {
                if (error) {
                    console.log(`get-data read file error > ${error.message}`);
                    response.set('Content-Type', 'text/json').status(500).send({message: error.message});
                }
                else response.set('Content-Type', 'text/json').status(200).send(data);
            });
        }
        else {
            const dataSchema = `{"home_tab_data":{"current_group":0,"groups":[{"name":"Home","bookmarks":[]}],"version":"${version}","timestamp":${Date.now()}}}`;
            !fs.existsSync(dataRoot) && fs.mkdirSync(dataRoot);
            fs.writeFile(dataFile, dataSchema, error => {
                if (error) {
                    console.log(`get-data create file error > ${error.message}`);
                    response.set('Content-Type', 'text/json').status(500).send({message: error.message});
                }
                else response.set('Content-Type', 'text/json').status(200).send(dataSchema);
            });
        }
    }
    else response.status(404).send('File Not Found.');
});

app.get('/get-apikey', async (request, response) => {
    const referer = request.get('referer');
    if (referer) {
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
    else response.status(404).send('File Not Found.');
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});