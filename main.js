'use strict'

const purgeCloudformationStacks = require('./purgeCloudformationStacks')

module.exports = (async () => {
  const {
    stackName,
    region,
    profile
  } = require('minimist')(process.argv.slice(2))

  try { await purgeCloudformationStacks({ stackName, region, profile }) }
  catch (error) { console.log(error) }
})()
