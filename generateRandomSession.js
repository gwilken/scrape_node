const generateRandomSessionId = () => {
  let alpha = 'abcdefghijklmnopqrstuvwxyz012345'
  let alphaArr = alpha.split('')
  let idArr = []
  for (i = 0; i < 24; i++) {
    idArr[i] = alphaArr[Math.floor(Math.random() * 32)]
  }
  return idArr.join('')
}

module.exports = generateRandomSessionId

