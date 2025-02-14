const sharp = require('sharp');
const fs = require('fs');

const thumbnailWidth = 256;
const thumbnailHeight = 192;
const iconWidth = 64;
const iconHeight = 64;

const randomColor = () => {
    let color = '';
    while (color.length < 6) {
        color += parseInt(Math.random()*255).toString(16).padStart(2, 0);
    }
    return color;
};

const imageComposer = async (fileProps, useFallback = false) => {
    const thumbnailType = fileProps.thumbnailType;
    const sourceWidth = fileProps.width;
    const sourceHeight = fileProps.height;
    let compositeTop = 0;
    let compositeLeft = 0;
    if (thumbnailType == 'favicon') {
        compositeTop = (thumbnailHeight - sourceWidth) / 2 - 10;
        compositeLeft = (thumbnailWidth - sourceHeight) / 2;
    }
    else if (thumbnailType == 'upload') {
        compositeLeft = sourceWidth == thumbnailWidth ? 0 : ((thumbnailWidth - sourceWidth) / 2);
        compositeTop = sourceHeight == thumbnailHeight ? 0 : ((thumbnailHeight - sourceHeight) / 2);
    } 
    let baseImage = await sharp({
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
    let sourceImage = await sharp(fileProps.thumbnailBuffer)
    .png()
    .toBuffer()
    .catch(error => console.log(`sharp error > buffer image: ${error.message}`));
    return await sharp(baseImage)
    .composite([{input: sourceImage, top: compositeTop, left: compositeLeft}])
    .toFile(fileProps.destPath)
    .then(async () => {
        baseImage = sourceImage = fileProps.thumbnailBuffer = null;
        return useFallback ?
            {status: 200, message: 'Error when creating thumbnail, please check input url.', filename: fileProps.destName} :
            {status: 200, filename: fileProps.destName};
    })
    .catch(error => {
        baseImage = sourceImage = fileProps.thumbnailBuffer = null;
        console.log(`sharp error > composite image: ${error.message}`);
        return {status: 304, message: 'Error when creating thumbnail, please try again later.'};
    });    
};

const useFallbackThumbnail = async (fileProps) => {
    const originUrl = fileProps.originUrl;
    const label =  originUrl.match(/^(www)\./i) != null ? originUrl.substring(4, 5) : originUrl.substring(0 ,1);
    const svg = `
        <svg width="${iconWidth}" height="${iconHeight}">
            <rect x="0" y="0" width="100%" height="100%" fill="#${randomColor()}" rx="5" ry="5" />
            <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" font-size="3em" font-family="Verdana" fill="#fff">${label.toUpperCase()}</text>
        </svg>
        `;
    fileProps.thumbnailType = 'favicon';
    fileProps.width = iconWidth;
    fileProps.height = iconHeight;
    fileProps.thumbnailBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return await imageComposer(fileProps, true);
};

const resizeToThumbnail = async (fileProps) => {
    return await sharp(fileProps.thumbnailBuffer)
    .resize(thumbnailWidth, thumbnailHeight)
    .png()
    .toFile(fileProps.destPath)
    .then(() => {        
        fileProps.thumbnailBuffer = null;
        return {status: 200, filename: fileProps.destName};
    })
    .catch(error => {
        console.log(`sharp error > resize image: ${error.message}`);
        return useFallbackThumbnail(fileProps);
    });
};

module.exports = {useFallbackThumbnail, resizeToThumbnail, imageComposer, thumbnailWidth, thumbnailHeight, iconWidth, iconHeight}