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

const imageComposer = async (fileProps, width, height, useFallback = false) => {
    const thumbnailType = fileProps.thumbnailType;
    let compositeTop = 0;
    let compositeLeft = 0;
    if (thumbnailType == 'favicon') {
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
    const sourceImage = await sharp(Buffer.from(fileProps.thumbnailBuffer))
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
    fileProps.thumbnailBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    fileProps.thumbnailType = 'favicon';
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

module.exports = {useFallbackThumbnail, resizeToThumbnail, imageComposer, thumbnailWidth, thumbnailHeight, iconWidth, iconHeight}