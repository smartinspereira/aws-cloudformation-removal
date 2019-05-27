'use strict'

const purgeCloudformationStacks = require('./purgeCloudformationStacks')

module.exports = (async () => {
  const stackName = process.argv.length === 3 ? process.argv[2] : undefined
  try { await purgeCloudformationStacks(stackName) }
  catch (error) { console.log(error) }
})()
