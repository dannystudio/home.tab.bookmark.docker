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

const randomColor = () => {
    let color = '';
    while (color.length < 6) {
        color += parseInt(Math.random()*255).toString(16).padStart(2, 0);
    }
    return color;
};

const imageComposer = async (fileProps, width, height, useFallback = false) => {
    const thumbnailType = fileProps.thumbnailType;
    let compositeTop = 0;thumbnailType == 'icon' || thumbnailType == 'upload' ? ((thumbnailHeight - width) / 2 - 10) : 0;
    let compositeLeft = 0;
    if (thumbnailType == 'icon') {
        compositeTop = (thumbnailHeight - width) / 2 - 10;
        compositeLeft = (thumbnailWidth - height) / 2;
    }
    else if (thumbnailType == 'upload') {
        compositeLeft = width == thumbnailWidth ? 0 : ((thumbnailWidth - width) / 2);
        compositeTop = height == thumbnailHeight ? 0 : ((thumbnailHeight - height) / 2);
    } 
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
            {status: 200, message: 'Error when creating thumbnail, please check input url.', filename: fileProps.destName} :
            {status: 200, filename: fileProps.destName};
    })
    .catch(error => {
        console.log(`sharp error > composite image: ${error.message}`);
        return {status: 304, message: 'Error when creating thumbnail, please try again later.', filename: fileProps.originName};
    });    
};

const useFallbackThumbnail = async (fileProps) => {
    const originName = fileProps.originName;
    const label =  originName.match(/^(www)\./i) != null ? originName.substring(4, 5) : originName.substring(0 ,1);
    const svg = `
        <svg width="${iconWidth}" height="${iconHeight}">
            <rect x="0" y="0" width="100%" height="100%" fill="#${randomColor()}" rx="5" ry="5" />
            <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" font-size="3em" font-family="Verdana" fill="#fff">${label.toUpperCase()}</text>
        </svg>
        `;
    thumbnailBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    fileProps.thumbnailType = 'icon';
    return await imageComposer(fileProps, iconWidth, iconHeight, true);
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
    const thumbnailType = fileProps.thumbnailType;
    const apiUrl = thumbnailType == 'icon' ? faviconAPI : ((fileProps.screenshotAPI && fileProps.screenshotAPI != '') ? fileProps.screenshotAPI : faviconAPI);
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
        if (thumbnailType == 'icon') {
            const metadata = await sharp(originPath).metadata();
            const originBufferWidth = (!metadata || !metadata.width) ? iconWidth : metadata.width;
            const originBufferHeight = (!metadata || !metadata.height) ? iconWidth : metadata.height;
            thumbnailBuffer = await sharp(originPath)
            .resize(originBufferWidth, originBufferHeight)
            .png()
            .toBuffer()
            .catch(error => console.log(`sharp error > buffer icon: ${error.message}`));
            return await imageComposer(fileProps, originBufferWidth, originBufferHeight);
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

const createThumbnailFromUpload = async (fileProps, uploadBuffer) => {
    const base64Data = uploadBuffer.replace(/^data:image\/\w+;base64,/, '');
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
        thumbnailBuffer = await sharp(Buffer.from(tempBuffer))
        .resize(toWidth, toHeight)
        .toBuffer();
        return await imageComposer(fileProps, toWidth, toHeight);
    })
    .catch(error => {
        console.log(`uplaod error > buffer from abse64, ${error.message}`);
        return useFallbackThumbnail(fileProps);
    });
};

const createThumbnail = async (fileProps) => {
    return await getImageFromAPI(fileProps);
};

module.exports = {createThumbnail, createThumbnailFromUpload};