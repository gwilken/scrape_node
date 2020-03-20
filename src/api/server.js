// api/server.js

const express = require('express')
const routes = require('./routes')
const bodyParser = require('body-parser')
const log = require('../utils/log')

const PORT = process.env.API_PORT || 80

const app = express()

app.use('/', routes)

app.listen(PORT, function() {
  log('[ SCRAPE_NODE ] - API server started:', PORT)
})
