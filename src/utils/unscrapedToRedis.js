const fsAsync = require('fs').promises;
const redisManager = require('../RedisManager')

const go = async () => {
  let data = await fsAsync.readFile('./unscraped_ids.txt', 'utf8')
  let ids = data.split('\n')

  let promises = ids.map(id => {
    return redisManager.publishToSet('verified', id)
  })

  let res = await Promise.all(promises)

  console.log('done.')
  process.exit()
}

go()

