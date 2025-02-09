const appName = 'Home Tab Bookmark';
const version = '1.0.0';
const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const url = require('url');

// Available ENV
const screenshotAPI = process.env.SCREENSHOT_API || 'false';
const openInNewTab = process.env.OPEN_IN_NEW_TAB || 'false';
const enableBasicAuth = process.env.BASIC_AUTH || 'false';
const username = process.env.USER_NAME || 'admin';
const password = process.env.PASSWORD || 'admin';

const port = 3000;
const faviconAPI = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=';
const dataFile = './data/home-tab-bookmark-data.json';
const thumbnailDir = './data/thumbnail';
const sleep = ms => new Promise(res => setTimeout(res, ms));
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

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(authentication);
app.use(express.static('public'));
app.use('/thumbnail',  express.static(thumbnailDir));

const parseUrlParts = address => {
    return url.parse(address, true);
};

const getFileNameAndPath = address => {
    const urlParts = parseUrlParts(address);
    const prefix = urlParts.hostname;
    !fs.existsSync(thumbnailDir) && fs.mkdirSync(thumbnailDir);
    const originName = `${prefix}-${Date.now()}_origin.png`;
    const originPath = `${thumbnailDir}/${originName}`;
    const destName = `${prefix}-${Date.now()}.png`;
    const destPath = `${thumbnailDir}/${destName}`;
    return [originName, originPath, destName, destPath];
};

const useDefaultThumbnail = (destPath, destName, originName) => {
    try {
        fs.copyFileSync('./default.thumbnail.png', destPath);
        return {status: 200, message: 'Error while creating thumbnail, use default thumbnail instead.', filename: destName};
    }
    catch (error) {
        console.log(`error during use default image, ${error.message}`);
        return {status: 304, message: 'Error while creating thumbnail, please try again later.', filename: originName};
    }
};

const downloadImage = async (address, type) => {
    const [originName, originPath, destName, destPath] = getFileNameAndPath(address);
    const apiUrl = type == 'icon' ? faviconAPI : ((screenshotAPI && screenshotAPI != '') ? screenshotAPI : faviconAPI);
    try {
        return await axios({
            url: `${apiUrl}${address}`,
            method: 'GET',
            responseType: 'stream'
        })
        .then(async response => {
            response.data.pipe(fs.createWriteStream(originPath));
            const thumbnailWidth = 256;
            const thumbnailHeight = 192;
            const originBufferWidth = type == 'icon' ? 64 : 256;
            const originBufferHeight = type == 'icon' ? 64 : 192;
            const compositeTop = type == 'icon' ? ((thumbnailHeight - originBufferHeight) / 2 - 10) : 0;
            const compositeLeft = type == 'icon' ? ((thumbnailWidth - originBufferWidth) / 2) : 0;
            const baseImage = await sharp({
                create: {
                    width: thumbnailWidth,
                    height: thumbnailHeight,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            })
            .png()
            .toBuffer()
            .catch(error => console.log(`error during creating base image, ${error.message}`));
            const originImage = await sharp(originPath)
            .resize(originBufferWidth, originBufferHeight)
            .png()
            .toBuffer()
            .catch(error => console.log(`error during resizing origin image, ${error.message}`));
            return await sharp(baseImage)
            .composite([{input: originImage, top: compositeTop, left: compositeLeft}])
            .toFile(destPath)
            .then(() => {
                fs.existsSync(originPath) && fs.unlinkSync(originPath);
                return {status: 200, filename: destName};
            })
            .catch(error => {
                console.log(`error during composite images, ${error.message}`);
                return useDefaultThumbnail(destPath, destName, originName);
            });
        })
        .catch(error => {
            console.log(`error during getting image, ${error.message}`);
            return useDefaultThumbnail(destPath, destName, originName);
        });
    }
    catch (error) {
        console.log(`error during getting image, ${error.message}`);
        return useDefaultThumbnail(destPath, destName, originName);
    }
};

app.get('/script.js', (request, response) => {
    const filePath = './private/script.js';
    fs.readFile(filePath, 'utf8', (error, originCode) => {
        if (error) {
            console.error(error.message);
            return response.status(500).send('Error reading file.');
        }
        let appVariables = `const appName='${appName}';const version='${version}';`;
        let envVariables = '';
        ((screenshotAPI != 'false' && screenshotAPI != 'none') || typeof puppeteerExtra === 'object') && (envVariables += 'const hasScreenshotAPI=true;');
        openInNewTab != 'false' && (envVariables += 'const openInNewTab=true;');
        const appendedCode = `${appVariables}${envVariables}${originCode}`;
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
                const result = thumbnailType == 'screen' && typeof puppeteerExtra === 'object' ?
                await takeScreenshot(queryParams.url) :
                await downloadImage(queryParams.url, thumbnailType);
                if (result.status == 200 && queryParams.delete) {
                    const deleteThumbnailPath = `${thumbnailDir}/${queryParams.delete}`;
                    fs.existsSync(deleteThumbnailPath) && fs.unlinkSync(deleteThumbnailPath);
                }
                response.set('Content-Type', 'text/plain').status(result.status).send(JSON.stringify(result));
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