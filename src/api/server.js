// api/server.js

const axios = require('axios')
const express = require('express')
const routes = require('./routes')
const bodyParser = require('body-parser')
const log = require('../utils/log')

const PORT = process.env.API_PORT || 8080
const COMMAND_URL = process.env.commandUrl || 'http://127.0.0.1:8888'
const AUTH = 'cmVkaXNhdXRob3JpemF0aW9uIQ=='
const ip = process.env.IP || '127.0.0.1'

const app = express()

app.use('/', routes)

app.listen(PORT, function() {
  log('[ SCRAPE_NODE ] - API server started:', PORT)

  axios.post(COMMAND_URL + '/alive', {
      ip,
    },
    {
      headers: {
        Authorization: AUTH
      }
    })

})
