const { assert } = require("chai")
const buildTransaction = require("./buildTransaction")
const { buildQrCodeFile, buildQrCodeDataURL } = require("../qr/buildQrCode")

// NOTE: All code should use this helper - this method is scattered all over
module.exports = async ({actions, endpoint}) => {
  
    assert(actions != null, "actions must be defined {actions:...}")

    const esr = await buildTransaction(actions, endpoint)
  
    // console.log(" esr "+esr)
  
    let qr = "ESR is too big for QR code: " + esr.length 
    if (esr.length < 3500) {
      qr = await buildQrCodeFile(esr)
    }
    return {
      esr,
      qr
    }
  }
  