const axios = require('axios')
const puppeteer = require('puppeteer');
const { IncomingWebhook } = require('@slack/webhook');

const sessionId = require('./generateRandomSession')

const SLACK_URL = process.env.SLACK_URL || 'https://hooks.slack.com/services/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';
const webhook = new IncomingWebhook(SLACK_URL);

const IP_ADDR = process.env.IP || null;
const BASE_URL = process.env.BASE_URL || null;
const COMMAND_URL = process.env.COMMAND_URL || 'http://127.0.0.1:8888';
const COOKIE = process.env.COOKIE || '';
const SLEEP_MIN = process.env.SLEEP_MIN || 1000;
const SLEEP_MAX = process.env.SLEEP_MAX || 10000;
const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36';

let errorCount = 0;
let errorMax = 10;

console.log('IP:', IP_ADDR)
console.log('C2 server:', COMMAND_URL)
console.log('Cookie:', COOKIE)
console.log('Base URL:', BASE_URL)
console.log('Sleep range:', SLEEP_MIN, SLEEP_MAX)


const fetchData = async (url) => {
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();

  // Pass the User-Agent Test.
  await page.setUserAgent(USER_AGENT);

  // Pass the Webdriver Test.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // Pass the Chrome Test.
  await page.evaluateOnNewDocument(() => {
    window.navigator.chrome = {
      runtime: {},
      // etc.
    };
  });

  // Pass the Permissions Test.
  await page.evaluateOnNewDocument(() => {
    const originalQuery = window.navigator.permissions.query;
    return window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });  

  // Pass the Plugins Length Test.
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'plugins', {
      // This just needs to have `length > 0` for the current test,
      // but we could mock the plugins too if necessary.
      get: () => [1, 2, 3, 4, 5],
    });
  });

  // Pass the Languages Test.
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  // Set the cookies
  const cookies = [{
    'url': BASE_URL,
    'name': 'UserSettings',
    'value': COOKIE
  },
  {
    'url': BASE_URL,
    'name': 'ASP.NET_SessionId',
    'value': sessionId()
  }];
  
  await page.setCookie(...cookies);
  const response = await page.goto(url, { waitUntil: 'networkidle2' });

  let bodyHTML = await page.evaluate(() => document.body.innerHTML);
  await browser.close();

  return {
      status: response.headers().status,
      bodyHTML
    }
  }


const sleep = (min, max) => {
  let ms = parseInt(min) + Math.round((Math.random() * (parseInt(max) - parseInt(min))))
  console.log(`Sleeping ${ms}ms`)
  return new Promise(resolve => setTimeout(resolve, ms));
}


const handleError = (msg, targetId = null) => {
  return new Promise( async (resolve) => {
    console.log(msg)
    
    errorCount++
    
    await axios.post(COMMAND_URL + '/errorlog', {
      timestamp: Date.now(),
      msg, 
      errorCount,
      ip: IP_ADDR,
      targetId
    }, {
      headers: {
        Authorization: 'cmVkaXNhdXRob3JpemF0aW9uIQ=='
      }
    }).catch(err => {});
  
    await webhook.send({
      text: `Scraper ${IP_ADDR}: Msg: ${msg}. Error count: ${errorCount}`,
    });
  
    resolve(null)
  })
}


const scrapeNextTarget = async () => {
  const response = await axios.get(COMMAND_URL + '/next-target', {
    headers: {
      Authorization: 'cmVkaXNhdXRob3JpemF0aW9uIQ=='
    }
  }).catch( async (err) => {
    handleError(`Error requesting next target:', ${err.response.status}, ${err.response.data.statusText}`)
    return null
  })

  if (response && response.data) {
    console.log('Next target response OK.')

    let targetUrl = response.data.targetUrl
    let targetId = response.data.targetId

    if (targetUrl) {
      console.log('Next target ID:', targetUrl)
  
      // fetch data from target
      let targetData = await fetchData(targetUrl)
        .catch( async (err) => {
          return null
        })
        
  
      if (targetData && targetData.bodyHTML !== '') {
        if (targetData.status > 300) {
          handleError(`Target server returned code: ${targetData.status}`, targetId)
        } 
        else {
          errorCount = 0
          console.log('Posting target data to C2 server.')
    
          // post data to c2 server
          let res = await axios.post(COMMAND_URL + '/data', {
            ip: IP_ADDR,
            timestamp: Date.now(),
            targetId, 
            data: targetData.bodyHTML,
            status: targetData.status
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
            handleError('No response from C2 server /data.', targetId)
          }
        } 
      } 
      else {
        handleError(`Received no data from target: ${targetId}`, targetId)
      }
    }
  }

  await sleep(SLEEP_MIN, SLEEP_MAX)

  if (errorCount < errorMax) {
    console.log('Scraping next target.')
    scrapeNextTarget()
  } else {
    await handleError(`Error max of ${errorMax} reached. Stopping.`)
    process.exit(0)
  }
}

scrapeNextTarget()
