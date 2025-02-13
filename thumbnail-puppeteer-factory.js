// puppeteer needs more works when runs in docker, let's use elestio/ws-screenshot docker for screenshot

// const tc = require('./thumbnail-common');

// // screenshot using puppeteer
// const puppeteerExtra = require('puppeteer-extra');
// const Stealth = require('puppeteer-extra-plugin-stealth');
// puppeteerExtra.use(Stealth());
// const takeScreenshot = async(fileProps) => {
//     const originPath = fileProps.originPath;
//     const browser = await puppeteerExtra.launch();
//     const page = await browser.newPage();
//     // await page.setDefaultNavigationTimeout(10000);
//     await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0');
//     return await page.goto(fileProps.thumbnailUrl)
//     .then(async () => {
//         await page.waitForNetworkIdle();
//         await page.setViewport({width: 1024, height: 768});
//         return await page.screenshot({path: originPath})
//         .then(async () => {
//             await browser.close();
//             return await tc.resizeToThumbnail(fileProps);
//         })
//         .catch(error => {
//             browser.close();
//             console.log(`puppeteer error > screenshot, ${error.message}`);
//             return tc.useFallbackThumbnail(fileProps);
//         });
//     })
//     .catch(error => {
//         browser.close();
//         console.log(`puppeteer error > goto, ${error.message}`);
//         return tc.useFallbackThumbnail(fileProps);
//     })
// };

// module.exports = {takeScreenshot}