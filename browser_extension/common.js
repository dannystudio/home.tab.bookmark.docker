const isFireFox = navigator.userAgent.match(/firefox/i) != null;
const browserObj = isFireFox ? browser : chrome;
const defaultTestUrl = 'http://localhost:3000';