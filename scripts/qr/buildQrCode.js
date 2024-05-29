const QRCode = require('qrcode')
const md5 = require('md5')
const fs = require('fs');
const path = require('path');

async function buildQrCodeFile(esr) {
    const filename = md5(esr)
    const imagesDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imagesDir)) {
        // Create the images directory
        fs.mkdirSync(imagesDir);
    }
    const filepath = path.join(imagesDir, `${filename}.png`);

    try {
        await QRCode.toDataURL(esr)
        await QRCode.toFile(filepath, esr)
        return filepath
    } catch (err) {
        console.error(err)
        return null
    }
}

async function buildQrCodeDataURL(esr) {
    try {
        return await QRCode.toDataURL(esr)
    } catch (err) {
        console.log("QR error "+err)
        //console.error(err)
        return null
    }
}

module.exports = { buildQrCodeFile, buildQrCodeDataURL }