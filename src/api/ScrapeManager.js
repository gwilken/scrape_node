const axios = require('axios')
const puppeteer = require('puppeteer');
const { IncomingWebhook } = require('@slack/webhook');
const log = require('../utils/log');

const SLACK_URL = process.env.SLACK_URL || 'https://hooks.slack.com/services/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';
const webhook = new IncomingWebhook(SLACK_URL);

const IP_ADDR = process.env.IP || null;


class ScrapeManager {
  constructor() {
    this.allowRun = false
    this.baseUrl = 'https://www.wrecksite.eu'
    this.sessionId = null
    this.cookie = ''
    this.commandUrl = 'http://127.0.0.1:8888'
    this.scrapeUrl = null
    this.sleepMin = 3000
    this.sleepMax = 5000
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/527.16 (KHTML, like Gecko) Chrome/63.0.3282.19 Safari/536.36'
    this.errorCount = 0
    this.errorMax = 10
    this.browser = null
    this.currentTargetUrl = null
    this.currentTargetId = null
    this.currentTargetStatus = null
    this.currentTargetBodyHTML = null
  }
  
  
  async start() {
    this.allowRun = true
    this.browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
    this.loop()
  }
  

  async stop() {
    this.allowRun = false
    await this.browser.close();
  }


  async loop() {
    if (this.allowRun) {
      await this.getNextTargetUrl()
      await this.fetchData()
      await this.sendDataToControl()
      await this.sleep()
      await this.checkErrorStatus()

      this.loop()
    }
  }


  async getNextTargetUrl() {
    this.currentTargetUrl = null
    this.currentTargetId = null

    if (!this.commandUrl) {
      await this.handleError(`Error commandUrl not set`)
      return
    }

    const response = await axios.get(this.commandUrl + '/next-target', {
      headers: {
        Authorization: 'cmVkaXNhdXRob3JpemF0aW9uIQ=='
      }
    })
  
    if (response && response.data) {
      let targetUrl = response.data.targetUrl
      let targetId = response.data.targetId
  
      if (targetUrl && targetId) {
        console.log('Next target URL:', targetUrl)
        console.log('Next target ID:', targetId)

        this.currentTargetUrl = targetUrl
        this.currentTargetId = targetId
      }
    } else {
      await this.handleError(`Error requesting next target from: ${this.commandUrl}`)
    }
  }

  async fetchData() {
    if (this.currentTargetUrl) {
      this.currentTargetStatus = null
      this.currentTargetBodyHTML = null

      const page = await this.browser.newPage();
      await page.setUserAgent(this.userAgent);

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });

      await page.evaluateOnNewDocument(() => {
        window.navigator.chrome = {
          runtime: {},
        };
      });

      await page.evaluateOnNewDocument(() => {
        const originalQuery = window.navigator.permissions.query;
        return window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });  

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      });

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });

      const cookies = [{
        'url': this.baseUrl,
        'name': 'UserSettings',
        'value': this.cookie
      },
      {
        'url': this.baseUrl,
        'name': 'ASP.NET_SessionId',
        'value': this.generateRandomSessionId()
      }];
      
      await page.setCookie(...cookies);
      const response = await page.goto(this.currentTargetUrl, { waitUntil: 'networkidle2' });

      let bodyHTML = await page.evaluate(() => document.body.innerHTML);

      this.currentTargetStatus = response.headers().status
      this.currentTargetBodyHTML = bodyHTML
    }
  }


  async sendDataToControl() {
    if (this.currentTargetStatus && this.currentTargetBodyHTML !== '') {
      if (this.currentTargetStatus > 300) {
        this.handleError(`Target server returned code: ${this.currentTargetStatus}`)
      } 
      else {
        this.errorCount = 0
        log('Posting target data to C2 server.')
  
        // post data to c2 server
        let res = await axios.post(this.commandUrl + '/data', {
          ip: IP_ADDR,
          timestamp: Date.now(),
          targetId: this.currentTargetId, 
          data: this.currentTargetBodyHTML,
          status: this.currentTargetStatus
        }, {
          headers: {
            Authorization: 'cmVkaXNhdXRob3JpemF0aW9uIQ=='
          }
        }).catch(err => {
          // TODO: console.log(err)
          return null
        });
  
        if (res) {
          console.log('C2 server response:', res.status)
        } else {
          this.handleError('No response from C2 server /data.')
        }
      } 
    } 
    else {
      this.handleError(`Received no data from target: ${this.currentTargetId}`)
    }
  }


  sleep() {
    if (this.sleepMin && this.sleepMax) {
      let ms = parseInt(this.sleepMin) + Math.round((Math.random() * (parseInt(this.sleepMax) - parseInt(this.sleepMin))))
      console.log(`Sleeping ${ms}ms`)
      return new Promise(resolve => setTimeout(resolve, ms));
    } else {
      this.handleError('Sleep variable(s) not set.')
    }
  }


  async checkErrorStatus() {
    if (this.errorCount >= this.errorMax) {
      await this.handleError(`Error max of ${this.errorMax} reached. Stopping.`)

      this.stop()

      await this.browser.close();

      await webhook.send({
        text: `Scraper ${IP_ADDR}: Stopped. Max error count [${this.errorCount}] reached. <@greg>`,
      });

      this.errorCount = 0
    } 
  }


  handleError = (msg) => {
    return new Promise( async (resolve) => {
      this.errorCount++
      
      log(`Error [${this.errorCount}]: ${msg}`)

      if (this.commandUrl) {
        await axios.post(this.commandUrl + '/errorlog', {
          timestamp: Date.now(),
          msg, 
          errorCount: this.errorCount,
          ip: IP_ADDR,
          targetId: this.currentTargetId
        }, {
          headers: {
            Authorization: 'cmVkaXNhdXRob3JpemF0aW9uIQ=='
          }
        }).catch(err => {});
      }
    
      resolve(null)
    })
  }


  getStatus() {
    return {
      allowRun: this.allowRun,
      baseUrl: this.baseUrl,
      sessionId: this.sessionId,
      cookie: this.cookie,
      commandUrl: this.commandUrl,
      scrapeUrl: this.scrapeUrl,
      sleepMin: this.sleepMin,
      sleepMax: this.sleepMax,
      userAgent: this.userAgent,
      errorCount: this.errorCount,
      currentTargetUrl: this.currentTargetUrl,
      currentTargetId: this.currentTargetId,
      currentTargetStatus: this.currentTargetStatus
    }
  }

  setCookie(value) {
    this.stop()
    this.cookie = value
    this.start()
  }
 
  setCommandUrl(value) {
    this.stop()
    this.commandUrl = value    
    this.start()
  }
  
  setBaseUrl(value) {
    this.stop()
    this.baseUrl = value
    this.start()
  }
  
  setScrapeUrl(value) {
    this.stop()
    this.scrapeUrl = value
    this.start()
  }

  setSleepMin(value) {
    this.stop()
    this.sleepMin = value
    this.start()
  }

  setSleepMax(value) {
    this.stop()
    this.sleepMax = value
    this.start()
  }

  setUserAgent(value) {
    this.stop()
    this.userAgent = value
    this.start()
  }

  updateConfig = (obj) => {
    if (obj.allowRun) {
      this.allowRun = obj.allowRun
    }
    if (obj.cookie) {
      this.setCookie(obj.cookie)
    }
    if (obj.commandUrl) {
      this.setCommandUrl(obj.commandUrl)
    }
    if (obj.scrapeUrl) {
      this.setScrapeUrl(obj.scrapeUrl)
    }
    if (obj.baseUrl) {
      this.setBaseUrl(obj.baseUrl)
    }
    if (obj.sleepMin) {
      this.setSleepMin(obj.sleepMin)
    }
    if (obj.sleepMax) {
      this.setSleepMax(obj.sleepMax)
    }
    if (obj.userAgent) {
      this.setUserAgent(obj.userAgent)
    }
  }

  generateRandomSessionId = () => {
    let alpha = 'abcdefghijklmnopqrstuvwxyz012345'
    let alphaArr = alpha.split('')
    let idArr = []
    for (let i = 0; i < 24; i++) {
      idArr[i] = alphaArr[Math.floor(Math.random() * 32)]
    }
    return idArr.join('')
  }
}

const scrapeManager = new ScrapeManager()

module.exports = scrapeManager
