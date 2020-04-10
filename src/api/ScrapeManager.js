const axios = require('axios')
const puppeteer = require('puppeteer');
const { IncomingWebhook } = require('@slack/webhook');
const log = require('../utils/log');


class ScrapeManager {
  constructor() {
    this.ipAddress = process.env.IP || null;
    this.allowRun = false;
    this.slackUrl = 'https://hooks.slack.com/services/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';
    this.slackWebhook = new IncomingWebhook(this.slackUrl);
    this.cookie = '';
    this.commandUrl = 'http://127.0.0.1:8888';
    this.scrapeUrl = null;
    this.sleepMin = 3000;
    this.sleepMax = 5000;
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/517.16 (KHTML, like Gecko) Chrome/63.0.3282.19 Safari/536.36';
    this.errorCount = 0;
    this.errorMax = 10;
    this.browser = null;
    this.currentTargetUrl = null;
    this.currentTargetId = null;
    this.currentTargetStatus = null;
    this.currentTargetBodyHTML = null;
    this.authorization = 'cmVkaXNhdXRob3JpemF0aW9uIQ==';
  }
  
  
  async start() {
    this.allowRun = true
    log('Starting...')
    this.loop()
  }
  

  async stop() {
    this.allowRun = false
    log('Stopping...')
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
        Authorization: this.authorization
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

      let url = new URL(this.currentTargetUrl)
      let baseUrl = `${url.protocol}//${url.hostname}`

      this.browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});

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
        'url': baseUrl,
        'name': 'UserSettings',
        'value': this.cookie
      },
      {
        'url': baseUrl,
        'name': 'ASP.NET_SessionId',
        'value': this.generateRandomSessionId()
      }];
      
      await page.setCookie(...cookies);
      const response = await page.goto(this.currentTargetUrl, { waitUntil: 'networkidle2' });

      let bodyHTML = await page.evaluate(() => document.body.innerHTML);

      await this.browser.close();

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
          ip: this.ipAddress,
          timestamp: Date.now(),
          targetId: this.currentTargetId, 
          data: this.currentTargetBodyHTML,
          status: this.currentTargetStatus
        }, {
          headers: {
            Authorization: this.authorization
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

      await this.slackWebhook.send({
        text: `Scraper ${this.ipAddress}: Stopped. Max error count [${this.errorCount}] reached. <@greg>`,
      });

      this.errorCount = 0
    } 
  }


  handleError(msg) {
    return new Promise( async (resolve) => {
      this.errorCount++
      
      log(`Error [${this.errorCount}]: ${msg}`)

      if (this.commandUrl) {
        await axios.post(this.commandUrl + '/errorlog', {
          timestamp: Date.now(),
          msg, 
          errorCount: this.errorCount,
          ip: this.ipAddress,
          targetId: this.currentTargetId
        }, {
          headers: {
            Authorization: this.authorization
          }
        }).catch(err => {});
      }
    
      resolve(null)
    })
  }

  getStatus() {
    return {
      ip: this.ipAddress,
      allowRun: this.allowRun,
      cookie: this.cookie,
      commandUrl: this.commandUrl,
      scrapeUrl: this.scrapeUrl,
      sleepMin: this.sleepMin,
      sleepMax: this.sleepMax,
      userAgent: this.userAgent,
      errorCount: this.errorCount,
      authorization :this.authorization,
      slackUrl: this.slackUrl,
      currentTargetUrl: this.currentTargetUrl,
      currentTargetId: this.currentTargetId,
      currentTargetStatus: this.currentTargetStatus
    }
  }

  setCookie(value) {
    this.cookie = value
  }
 
  setCommandUrl(value) {
    this.commandUrl = value    
  }
  
  setScrapeUrl(value) {
    this.scrapeUrl = value
  }

  setSleepMin(value) {
    this.sleepMin = value
  }

  setSleepMax(value) {
    this.sleepMax = value
  }

  setUserAgent(value) {
    this.userAgent = value
  }

  updateConfig(obj) {
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

  generateRandomSessionId() {
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
