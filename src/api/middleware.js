// api/middleware.js

const scrapeManager = require('./ScrapeManager')
const log = require('../utils/log');


const handleError = async (msg) => {

}


const updateConfig = (req, res, next) => {
  // log(req.body)
  if (!req.body) {
    res.status(500).json('No data in message body.')
  } else {
      scrapeManager.updateConfig(req.body)
      res.status(200).json('OK')
    }
}


const startScrape = (req, res, next) => {
  scrapeManager.start()
  res.status(200).json('OK')
}


const stopScrape = (req, res, next) => {
  scrapeManager.stop()
  res.status(200).json('OK')
}


const getConfig = (req, res, next) => {
  let status = scrapeManager.getStatus()
  res.status(200).json(status)
}


const validateMessage = (req, res, next) => {
  if (req.headers.authorization) {
    let { authorization } = req.headers
    let buff = new Buffer.from(authorization, 'base64');
    let text = buff.toString('ascii');
    if (text == 'redisauthorization!') {
      next()
    } else {
      handleError('Message validation failed.')
      res.status(403).json('Message validation failed.')
    }
  } else {
    handleError('Message validation failed.')
    res.status(403).json('Message validation failed.')
  }
}


module.exports = {
  validateMessage,
  updateConfig,
  startScrape,
  stopScrape,
  getConfig
}
