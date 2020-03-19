// place previous scraped ids into 'verfied' key. redoing them!

const fsAsync = require('fs').promises;
const redisManager = require('../RedisManager')

const go = async () => {
  let nonNulls = await fsAsync.readFile('./known_good_ids.txt', 'utf8')
  let fullList = nonNulls.split('\n')
  
  let promises = fullList.map(id => {
    return redisManager.publishToSet('todo', id)
  })

  let res = await Promise.all(promises)

  console.log('done.')
  process.exit()
}

go()

