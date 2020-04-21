// api/server.js

const axios = require('axios')
const express = require('express')
const routes = require('./routes')
const bodyParser = require('body-parser')
const { setSecureHeaders } = require('./middleware')
// const { ip } = require('../utils/getPublicIp')

const log = require('../utils/log')

const PORT = process.env.API_PORT || 8080
const COMMAND_URL = process.env.commandUrl || 'http://127.0.0.1:8888'
const AUTH = 'cmVkaXNhdXRob3JpemF0aW9uIQ=='

const app = express()

app.use(setSecureHeaders);
app.use('/', routes)


app.listen(PORT, () => {
  log('[ SCRAPE_NODE ] - API server started:', PORT)

  axios.get('http://icanhazip.com').then(res => {

    let ip = res.data

    axios.post(COMMAND_URL + '/alive', {
        ip,
      },
      {
        headers: {
          Authorization: AUTH
        }
      }
    )
  })
})
