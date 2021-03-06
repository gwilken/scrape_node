// api/routes.js
const log = require('../utils/log');

const router = require('express').Router()
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()
const { 
  // validateMessage,
  updateConfig,
  startScrape,
  stopScrape,
  getConfig
} = require('./middleware');


router.get('/health', (req, res) => {
  res.status(200).json('OK')
})


router.get('/start',
  // validateMessage,
  startScrape
)


router.get('/stop',
  // validateMessage,
  stopScrape
)
  
  
router.get('/config',
  // validateMessage,
  getConfig
)

router.post('/config',
  // validateMessage,
  jsonParser,
  updateConfig
)


// router.get('/kill', (req, res) => {
//   validateMessage,
//   res.status(200).json('OK'),
//   process.exit()
// })


module.exports = router
