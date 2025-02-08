const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Available ENV
const screenshotAPI = process.env.SCREENSHOT_API || 'false';
const openInNewTab = process.env.OPEN_IN_NEW_TAB || 'false';

const port = 3000;
const faviconAPI = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=';
const dataFile = './data/home-tab-bookmark-data.json';
const thumbnailDir = './data/thumbnail';
const sleep = ms => new Promise(res => setTimeout(res, ms));
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static('public'));
app.use("/thumbnail",  express.static(`${__dirname}/data/thumbnail`));

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

const useDefaultThumbnail = (destPath, originName) => {
    fs.copyFile('./default.thumbnail.png', destPath, error => {
        if (error) {
            console.log(`error during use default image, ${error.message}`);
            return false;
        }
    });
    return true;
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
                return useDefaultThumbnail(destPath, originName) ?
                {status: 200, message: 'Error while creating thumbnail, use default thumbnail instead.', filename: destName} :
                {status: 500, message: 'Error while creating thumbnail, please try again later.', filename: originName};
            });
        })
        .catch(error => {
            console.log(`error during getting image, ${error.message}`);
            return useDefaultThumbnail(destPath, originName) ?
            {status: 200, message: 'Error while creating thumbnail, use default thumbnail instead.', filename: destName} :
            {status: 500, message: 'Error while creating thumbnail, please try again later.', filename: originName};
        });
    }
    catch (error) {
        return useDefaultThumbnail(destPath, originName) ?
        {status: 200, message: 'Error while creating thumbnail, use default thumbnail instead.', filename: destName} :
        {status: 500, message: 'Error while creating thumbnail, please try again later.', filename: originName};
    }
};

app.get('/script.js', (request, response) => {
    const filePath = path.join(__dirname, 'private', 'script.js');
    fs.readFile(filePath, 'utf8', (error, originCode) => {
        if (error) {
            console.error(error.message);
            return response.status(500).send('Error reading file.');
        }
        let envVariables = '';
        (screenshotAPI != 'false' && screenshotAPI != 'none') && (envVariables += 'const hasScreenshotAPI=true;');
        openInNewTab != 'false' && (envVariables += 'const openInNewTab=true;');
        const appendedCode = `${envVariables}${originCode}`;
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
                const result = await downloadImage(queryParams.url, thumbnailType);
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