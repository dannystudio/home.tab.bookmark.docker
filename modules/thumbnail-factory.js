const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const {useFallbackThumbnail, resizeToThumbnail, imageComposer, thumbnailWidth, thumbnailHeight, iconWidth, iconHeight} = require('./thumbnail-common');

const faviconAPI = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=';
let usePuppeteer = false;

const sleep = ms => new Promise(res => setTimeout(res, ms));

const getImageFromAPI = async (fileProps) => {
    const thumbnailType = fileProps.thumbnailType;
    const apiUrl = thumbnailType == 'favicon' ? faviconAPI : ((fileProps.screenshotAPI && fileProps.screenshotAPI != '') ? fileProps.screenshotAPI : faviconAPI);
    return await axios({
        url: `${apiUrl}${fileProps.thumbnailUrl}`,
        method: 'GET',
        responseType: 'arraybuffer'
    })
    .then(async response => {
        let tempBuffer = Buffer.from(response.data, 'binary');
        if (thumbnailType == 'favicon') {
            const metadata = await sharp(tempBuffer).metadata();
            fileProps.width = (!metadata || !metadata.width) ? iconWidth : metadata.width;
            fileProps.height = (!metadata || !metadata.height) ? iconHeight : metadata.height;
            fileProps.thumbnailBuffer = await sharp(tempBuffer)
            .resize(fileProps.width, fileProps.height)
            .png()
            .toBuffer()
            .catch(error => console.log(`sharp error > buffer icon: ${error.message}`));
            tempBuffer = null;
            return await imageComposer(fileProps);
        }
        else {
            fileProps.thumbnailBuffer = tempBuffer;
            tempBuffer = null;
            return await resizeToThumbnail(fileProps);
        }
    })
    .catch(error => {
        console.log(`axios error > get remote image, ${error.message}`);
        return useFallbackThumbnail(fileProps);
    });
};

const createThumbnailFromUpload = async (fileProps) => {
    const base64Data = fileProps.uploadBuffer.replace(/^data:image\/\w+;base64,/, '');
    let tempBuffer = await sharp(Buffer.from(base64Data, 'base64')).png().toBuffer();
    return await sharp(tempBuffer)
    .metadata()
    .then(async metadata => {
        if (!metadata || !metadata.width) {
            throw new Error('unable to get image dimension');
        }
        let bufferWidth = (!metadata || !metadata.width) ? thumbnailWidth : metadata.width;
        let bufferHeight = (!metadata || !metadata.height) ? thumbnailHeight : metadata.height;
        if (bufferWidth > bufferHeight) {
            bufferHeight = Math.floor(bufferHeight / (bufferWidth / thumbnailWidth));
            bufferWidth = thumbnailWidth;
        }
        else if(bufferHeight > bufferWidth) {
            bufferWidth = Math.floor(bufferWidth / (bufferHeight / thumbnailHeight));
            bufferHeight = thumbnailHeight;
        }
        fileProps.width = bufferWidth;
        fileProps.height = bufferHeight;
        fileProps.thumbnailBuffer = await sharp(tempBuffer)
        .resize(bufferWidth, bufferHeight)
        .toBuffer();
        tempBuffer = null;
        return await imageComposer(fileProps);
    })
    .catch(error => {
        tempBuffer = null;
        console.log(`uplaod error > buffer from abse64, ${error.message}`);
        return useFallbackThumbnail(fileProps);
    });
};

const createThumbnail = async (fileProps) => {
    return fileProps.thumbnailType == 'screenshot' && typeof takeScreenshot === 'function' ?
    await takeScreenshot(fileProps) :
    (
        fileProps.thumbnailType == 'upload' ? 
        await createThumbnailFromUpload(fileProps) : 
        await getImageFromAPI(fileProps)
    );
};

const {takeScreenshot} = require('./thumbnail-puppeteer-factory');
typeof takeScreenshot === 'function' && (usePuppeteer = true);
module.exports = {createThumbnail, usePuppeteer};