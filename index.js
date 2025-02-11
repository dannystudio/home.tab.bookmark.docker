const appName = 'Home Tab Bookmark';
const version = '1.0.0';
const express = require('express');
const ping = require('ping');
const url = require('url');
const fs = require('fs');
const tf = require('./thumbnail-factory');

// Available ENV
const screenshotAPI = process.env.SCREENSHOT_API || 'false';
const openInNewTab = process.env.OPEN_IN_NEW_TAB || 'false';
const enableBasicAuth = process.env.BASIC_AUTH || 'false';
const username = process.env.USER_NAME || 'admin';
const password = process.env.PASSWORD || 'admin';
const port = process.env.PORT || 3000;

const dataFile = './data/home-tab-bookmark-data.json';
const thumbnailDir = './data/thumbnail';

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

const getThumbnailProperties = (address, thumbnailType, screenshotAPI) => {
    const urlParts = parseUrlParts(address);
    const prefix = urlParts.hostname;
    !fs.existsSync(thumbnailDir) && fs.mkdirSync(thumbnailDir);
    const originUrl = address;
    const originName = `${prefix}-${Date.now()}_origin.png`;
    const originPath = `${thumbnailDir}/${originName}`;
    const destName = `${prefix}-${Date.now()}.png`;
    const destPath = `${thumbnailDir}/${destName}`;
    return {originUrl, thumbnailType, originName, originPath, destName, destPath, screenshotAPI};
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
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
        ((screenshotAPI != 'false' && screenshotAPI != 'none') || typeof tf.puppeteerExtra === 'object') && (envVariables += ',hasScreenshotAPI=true');
        openInNewTab != 'false' && (envVariables += ',openInNewTab=true');
        const appendedCode = `${appVariables}${envVariables};${originCode}`;
        response.set('Content-Type', 'text/javascript').send(appendedCode);
    });
});

app.get('/process', async (request, response) => {
    const urlParts = parseUrlParts(request.url);
    const queryParams = urlParts.query;
    const action = queryParams.action;
    if (action == 'reload') {
        const thumbnailType = queryParams.type ? queryParams.type : 'icon';
        if (queryParams.url) {
            try {
                const pingresult = await ping.promise.probe(queryParams.url.replace(/(https|http):\/\//i, '').split('/')[0]);
                if (pingresult.alive) {
                    const fileProps = getThumbnailProperties(queryParams.url, thumbnailType, screenshotAPI);
                    const result = await tf.createThumbnail(fileProps);
                    if (result.status == 200 && queryParams.delete) {
                        const deleteThumbnailPath = `${thumbnailDir}/${queryParams.delete}`;
                        fs.existsSync(deleteThumbnailPath) && fs.unlinkSync(deleteThumbnailPath);
                    }
                    response.set('Content-Type', 'text/plain').status(result.status).send(JSON.stringify(result));
                }
                else {
                    response.set('Content-Type', 'text/plain').status(404).send(JSON.stringify({status: 404, message: 'Unable reslove the url, please check the url and then try again.'}));
                }
            }
            catch (error) {
                // nothing for now
            }
        }
    }
    else if (action == 'delete') {
        const deleteThumbnailPath = `${thumbnailDir}/${queryParams.filename}`;
        try {
            fs.existsSync(deleteThumbnailPath) && fs.unlinkSync(deleteThumbnailPath);
            response.set('Content-Type', 'text/plain').status(200).send(queryParams.filename);
        }
        catch (error) {
            response.status(500).send(error.message);
        }
    }
    else if (action == 'restore') {
        fs.readFile(dataFile, (error, data) => {
            error ? 
            response.status(404).send('Error, Data File Not Found.') :
            response.set('Content-Type', 'text/plain').status(200).send(data);
        });
    }
});

app.post('/process',(request, response) => {
    const urlParts = parseUrlParts(request.url);
    const queryParams = urlParts.query;
    const action = queryParams.action;
    if (action == 'backup') {
        fs.writeFile(dataFile, JSON.stringify(request.body), error => {
            error ?
            response.status(500).send('Error, Data Writing Error.') :
            response.set('content-type', 'text/plain').status(200).send(JSON.stringify(request.body));
        });       
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});