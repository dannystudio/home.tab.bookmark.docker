const axios = require('axios');
const sharp = require('sharp');
const {screenshotV1} = require('getscreenshot.js');

const thumbnailWidth = 256;
const thumbnailHeight = 192;
const iconWidth = 64;
const iconHeight = 64;
const faviconAPI = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=';

const getRandomColor = () => {
    let color = '';
    while (color.length < 6) color += parseInt(Math.random()*255).toString(16).padStart(2, 0);
    return color;
};

const getBufferDimension = async fileProps => {
    return await sharp(fileProps.thumbnailBuffer)
    .metadata()
    .then(data => {
        return {width: data.width, height: data.height};
    })
    .catch(error => {
        console.log(`sharp error > metadata error: ${error.message}`);
        return {
            width: fileProps.thumbnailType == 'favicon' ? iconWidth : thumbnailWidth,
            height:  fileProps.thumbnailType == 'favicon' ? iconHeight : thumbnailHeight
        };
    });
};

const saveToThumbnail = async fileProps => {
    return await sharp(fileProps.thumbnailBuffer)
    .toFile(fileProps.destPath)
    .then(() => {
        fileProps.thumbnailBuffer = null;
        return {status: 200, filename: fileProps.destName};
    })
    .catch(error => {
        fileProps.thumbnailBuffer = null;
        console.log(`sharp error > to file: ${error.message}`);
        return {status: 500, message: 'Unable to create thumbnail, please try again later.'};
    });
};

const extractImage = async fileProps => {
    fileProps.thumbnailBuffer =  await sharp(fileProps.thumbnailBuffer)
    .extract({
        width: thumbnailWidth,
        height: thumbnailHeight,
        top: 0,
        left: 0
    })
    .toBuffer();
    return saveToThumbnail(fileProps);
};

const extendImage = async fileProps => {
    const topBottom = Math.floor((thumbnailHeight - fileProps.height) / 2);
    const leftRight = Math.floor((thumbnailWidth - fileProps.width) / 2);
    fileProps.thumbnailBuffer = await sharp(fileProps.thumbnailBuffer)
    .extend({
        top: Math.max(topBottom - 10, 0),
        left: leftRight,
        bottom: topBottom + 10,
        right: leftRight,
        background: {r: 0, g: 0, b: 0, alpha: 0}
    })
    .toBuffer();
    return saveToThumbnail(fileProps);
};

const resizeImage = async fileProps => {
    const {width, height} = await getBufferDimension(fileProps);
    let targetWidth = thumbnailWidth;
    let targetHeight = thumbnailHeight;
    if (fileProps.thumbnailType == 'screenshot') {
        targetHeight = Math.floor(height / (width / thumbnailWidth));
    }
    else if(fileProps.thumbnailType == 'upload') {
        if (width >= height) {
            targetHeight = Math.floor(height / (width / thumbnailWidth));
        }
        else if(height > width) {
            targetWidth = Math.floor(width / (height / thumbnailHeight));
        }
    }
    return await sharp(fileProps.thumbnailBuffer)
    .resize(targetWidth, targetHeight)
    .toBuffer();
};

const useFallbackThumbnail = async fileProps => {
    const originUrl = fileProps.originUrl;
    const label =  originUrl.match(/^(www)\./i) != null ? originUrl.substring(4, 5) : originUrl.substring(0 ,1);
    const svg = `<svg width="${iconWidth}" height="${iconHeight}"><rect x="0" y="0" width="100%" height="100%" fill="#${getRandomColor()}" rx="5" ry="5" /><text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" font-size="3em" font-family="Verdana" fill="#fff">${label.toUpperCase()}</text></svg>`;
    fileProps.thumbnailType = 'favicon';
    fileProps.width = iconWidth;
    fileProps.height = iconHeight;
    fileProps.thumbnailBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return await extendImage(fileProps);
};

const prepareImage = async fileProps => {
    const {width, height} = await getBufferDimension(fileProps);
    const thumbnailType = fileProps.thumbnailType;
    if (thumbnailType == 'favicon') {
        fileProps.width = width;
        fileProps.height = height;
        return await extendImage(fileProps);
    }
    else if (thumbnailType == 'screenshot') {
        fileProps.thumbnailBuffer = await resizeImage(fileProps);
        const dimension = await getBufferDimension(fileProps);
        fileProps.width = dimension.width;
        fileProps.height = dimension.height;
        return dimension.height > thumbnailHeight ? await extractImage(fileProps) : await extendImage(fileProps);
    }
    else if (thumbnailType == 'upload') {
        if (width > height) {
            fileProps.width = thumbnailWidth;
            fileProps.height = Math.floor(height / (width / thumbnailWidth));
        }
        else if(height > width) {
            fileProps.width = Math.floor(width / (height / thumbnailHeight));
            fileProps.height = thumbnailHeight;
        }
        fileProps.thumbnailBuffer = await resizeImage(fileProps)
        return await extendImage(fileProps);
    }
};

const getImageFromAPI = async fileProps => {
    const thumbnailType = fileProps.thumbnailType;
    const apiUrl = thumbnailType == 'favicon' ? faviconAPI : ((fileProps.screenshotAPI != '') ? fileProps.screenshotAPI : faviconAPI);
    return await axios({
        url: `${apiUrl}${fileProps.thumbnailUrl}`,
        method: 'GET',
        responseType: 'arraybuffer'
    })
    .then(async response => {
        fileProps.thumbnailBuffer = Buffer.from(response.data, 'binary');
        return await prepareImage(fileProps);
    })
    .catch(error => {
        console.log(`axios error > get remote image, ${error.message}`);
        return useFallbackThumbnail(fileProps);
    });
};

const handleImageUpload = async fileProps => {
    const base64Data = fileProps.uploadBuffer.replace(/^data:image\/\w+;base64,/, '');
    fileProps.thumbnailBuffer = await sharp(Buffer.from(base64Data, 'base64')).png().toBuffer();
    return await prepareImage(fileProps);
};

const getScreenshot = async fileProps => {
    return await screenshotV1(fileProps.thumbnailUrl)
    .then(async data => {
        fileProps.thumbnailBuffer = await sharp(Buffer.from(data)).png().toBuffer();
        return await prepareImage(fileProps);
    })
    .catch(error => {
        console.log(`screenshot error > v1 error, ${error.message}`);
        return useFallbackThumbnail(fileProps);
    });
};

const createThumbnail = async (fileProps) => {
    return fileProps.thumbnailType == 'upload' ?
    await handleImageUpload(fileProps) : 
    (
        fileProps.thumbnailType == 'screenshot' && fileProps.screenshotAPI == '' ?
        await getScreenshot(fileProps) :
        await getImageFromAPI(fileProps)
    );
};

const saveBackgroundImage = async (props) => {
    const base64Data = props.buffer.replace(/^data:image\/\w+;base64,/, '');
    return await sharp(Buffer.from(base64Data, 'base64'))
    .metadata()
    .then(async data => {
        const fileExt = data.format ? data.format : 'jpg';
        const destName = `background-${Date.now()}.${fileExt}`;
        const destPath = `${props.dir}/${destName}`;
        return await sharp(Buffer.from(base64Data, 'base64'))
        .toFile(destPath)
        .then(() => {
            return {status: 200, filepath: `/background/${destName}`};
        })
        .catch(error => {
            return {status: 500, message: 'Unable to apply background.'};
        });
    })
    .catch(error => {
        return {status: 500, message: 'Unable to apply background.'};
    });
};

module.exports = {createThumbnail, saveBackgroundImage};