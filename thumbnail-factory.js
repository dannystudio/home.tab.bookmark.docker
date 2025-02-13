const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const tc = require('./thumbnail-common');

const faviconAPI = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=';
let usePuppeteer = false;

const sleep = ms => new Promise(res => setTimeout(res, ms));

const getImageFromAPI = async (fileProps) => {
    const originPath = fileProps.originPath;
    const thumbnailType = fileProps.thumbnailType;
    const apiUrl = thumbnailType == 'favicon' ? faviconAPI : ((fileProps.screenshotAPI && fileProps.screenshotAPI != '') ? fileProps.screenshotAPI : faviconAPI);
    return await axios({
        url: `${apiUrl}${fileProps.thumbnailUrl}`,
        method: 'GET',
        responseType: 'stream'
    })
    .then(async response => {
        await response.data.pipe(fs.createWriteStream(originPath));
        while(!fs.existsSync(originPath)) {
            await sleep(250);
        }
        if (thumbnailType == 'favicon') {
            const metadata = await sharp(originPath).metadata();
            const originBufferWidth = (!metadata || !metadata.width) ? tc.iconWidth : metadata.width;
            const originBufferHeight = (!metadata || !metadata.height) ? tc.iconHeight : metadata.height;
            fileProps.thumbnailBuffer = await sharp(originPath)
            .resize(originBufferWidth, originBufferHeight)
            .png()
            .toBuffer()
            .catch(error => console.log(`sharp error > buffer icon: ${error.message}`));
            return await tc.imageComposer(fileProps, originBufferWidth, originBufferHeight);
        }
        else {
            return await tc.resizeToThumbnail(fileProps);
        }
    })
    .catch(error => {
        console.log(`axios error > get remote image, ${error.message}`);
        return tc.useFallbackThumbnail(fileProps);
    });
};

const createThumbnailFromUpload = async (fileProps) => {
    const thumbnailWidth = tc.thumbnailWidth;
    const thumbnailHeight = tc.thumbnailheight;
    const base64Data = fileProps.uploadBuffer.replace(/^data:image\/\w+;base64,/, '');
    const tempBuffer = await sharp(Buffer.from(base64Data, 'base64')).png().toBuffer();
    return await sharp(Buffer.from(tempBuffer))
    .metadata()
    .then(async metadata => {
        if (!metadata || !metadata.width) {
            throw new Error('unable to get image dimension');
        }
        let toWidth = thumbnailHeight;
        let toHeight = thumbnailHeight;
        const tempWidth = metadata.width;
        const tempHeight = metadata.height;
        if (tempWidth > tempHeight) {
            toWidth = thumbnailWidth;
            toHeight = Math.floor(tempHeight / (tempWidth / thumbnailWidth));
        }
        else if(tempHeight > tempWidth) {
            toHeight = thumbnailHeight;
            toWidth = Math.floor(tempWidth / (tempHeight / thumbnailHeight));
        }
        fileProps.thumbnailBuffer = await sharp(Buffer.from(tempBuffer))
        .resize(toWidth, toHeight)
        .toBuffer();
        return await tc.imageComposer(fileProps, toWidth, toHeight);
    })
    .catch(error => {
        console.log(`uplaod error > buffer from abse64, ${error.message}`);
        return tc.useFallbackThumbnail(fileProps);
    });
};

const createThumbnail = async (fileProps) => {
    return fileProps.thumbnailType == 'screenshot' && typeof pf.takeScreenshot === 'function' ?
    await pf.takeScreenshot(fileProps) :
    (
        fileProps.thumbnailType == 'upload' ? 
        await createThumbnailFromUpload(fileProps) : 
        await getImageFromAPI(fileProps)
    );
};

const pf = require('./thumbnail-puppeteer-factory');
typeof pf.takeScreenshot === 'function' && (usePuppeteer = true);
module.exports = {createThumbnail, usePuppeteer};