// place new scraped into completed.

const fsAsync = require('fs').promises;
const redisManager = require('../RedisManager')

const go = async () => {
  let data = await fsAsync.readFile('./03082020_scraped_ids.txt', 'utf8')
  let ids = data.split('\n')

  let promises = ids.map(id => {
    return redisManager.publishToSet('completed', id)
  })

  let res = await Promise.all(promises)

  console.log('done.')
  process.exit()
}

go()

