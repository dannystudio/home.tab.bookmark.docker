const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');

const thumbnailWidth = 256;
const thumbnailHeight = 192;
const iconWidth = 64;
const iconHeight = 64;
let thumbnailBuffer;
const faviconAPI = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=';
const sleep = ms => new Promise(res => setTimeout(res, ms));

const imageComposer = async (type, width, height, fileProps, useFallback = false) => {
    const compositeTop = type == 'icon' ? ((thumbnailHeight - width) / 2 - 10) : 0;
    const compositeLeft = type == 'icon' ? ((thumbnailWidth - height) / 2) : 0;  
    const baseImage = await sharp({
        create: {
            width: thumbnailWidth,
            height: thumbnailHeight,
            channels: 4,
            background: {
                r: 0,
                g: 0,
                b: 0,
                alpha: 0
            }
        }
    })
    .png()
    .toBuffer()
    .catch(error => console.log(`sharp error > create base image: ${error.message}`));
    const sourceImage = await sharp(Buffer.from(thumbnailBuffer))
    .png()
    .toBuffer()
    .catch(error => console.log(`sharp error > buffer image: ${error.message}`));
    return await sharp(baseImage)
    .composite([{input: sourceImage, top: compositeTop, left: compositeLeft}])
    .toFile(fileProps.destPath)
    .then(() => {
        fs.existsSync(fileProps.originPath) && fs.unlinkSync(fileProps.originPath);
        return useFallback ?
            {status: 200, message: 'Error when creating thumbnail, use generic thumbnail instead.', filename: fileProps.destName} :
            {status: 200, filename: fileProps.destName};
    })
    .catch(error => {
        console.log(`sharp error > composite image: ${error.message}`);
        return {status: 304, message: 'Error when creating thumbnail, please try again later.', filename: fileProps.originName};
    });    
};

const useFallbackThumbnail = async (fileProps) => {
    const originName = fileProps.originName;
    const label =  originName.substring(0, 4) == 'www.' ? originName.substring(4, 5) : originName.substring(0 ,1);
    const svg = `
        <svg width="${iconWidth}" height="${iconHeight}">
            <rect x="0" y="0" width="100%" height="100%" fill="#0e8dbc" rx="5" ry="5" />
            <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" font-size="3em" font-family="Verdana" fill="#fff">${label.toUpperCase()}</text>
        </svg>
        `;
    thumbnailBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return await imageComposer('icon', iconWidth, iconHeight, fileProps, true);
};

const resizeToThumbnail = async (fileProps) => {
    const originPath = fileProps.originPath;
    return await sharp(originPath)
    .resize(thumbnailWidth, thumbnailHeight)
    .png()
    .toFile(fileProps.destPath)
    .then(() => {        
        fs.existsSync(originPath) && fs.unlinkSync(originPath);
        return {status: 200, filename: fileProps.destName};
    })
    .catch(error => {
        console.log(`sharp error > resize image: ${error.message}`);
        return useFallbackThumbnail(fileProps);
    });
};

const getImageFromAPI = async (fileProps) => {
    const originPath = fileProps.originPath;
    const type = fileProps.thumbnailType;
    const apiUrl = type == 'icon' ? faviconAPI : ((fileProps.screenshotAPI && fileProps.screenshotAPI != '') ? fileProps.screenshotAPI : faviconAPI);
    return await axios({
        url: `${apiUrl}${fileProps.originUrl}`,
        method: 'GET',
        responseType: 'stream'
    })
    .then(async response => {
        await response.data.pipe(fs.createWriteStream(originPath));
        const originBufferWidth = type == 'icon' ? iconWidth : thumbnailWidth;
        const originBufferHeight = type == 'icon' ? iconHeight : thumbnailHeight;
        while(!fs.existsSync(originPath)) {
            await sleep(250);
        }
        if (type == 'icon') {
            thumbnailBuffer = await sharp(originPath)
            .resize(originBufferWidth, originBufferHeight)
            .png()
            .toBuffer()
            .catch(error => console.log(`sharp error > buffer icon: ${error.message}`));
            return await imageComposer(type, originBufferWidth, originBufferHeight, fileProps);    
        }
        else {
            return await resizeToThumbnail(fileProps);
        }
    })
    .catch(error => {
        console.log(`axios error > get remote image, ${error.message}`);
        return useFallbackThumbnail(fileProps);
    });
};

const createThumbnail = async (fileProps) => {
    return await getImageFromAPI(fileProps);
};

module.exports = {createThumbnail};