const { SuiClient, logger, parseCheckpointId } = require('./parse-baku')
require("dotenv").config()

const BATCH_SIZE = 100      // 12 min per 1000 blocks

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

const rpcSui = new SuiClient({ url: process.env.RPC_BAKU })


async function fetchCheckpoints() {
  const bakuCheckpoint = await rpcSui.getLatestCheckpointSequenceNumber()
  const bakuCheckpointDB = (await db('baku_metrics').max('checkpoint'))[0].max

  if (bakuCheckpoint - bakuCheckpointDB > BATCH_SIZE + 1) {
    logger.debug(`Latest checkpoint ${bakuCheckpoint}, latest checkpoint in Database ${bakuCheckpointDB}, fetching...`)

    const start = parseInt((bakuCheckpointDB + 1) / BATCH_SIZE)
    const end = parseInt(bakuCheckpoint / BATCH_SIZE)

    for (let heightBatch = start; heightBatch < end; heightBatch++) {
      const promises = []

      for (let heightOffset = 0; heightOffset < BATCH_SIZE; heightOffset++) {
        const height = heightBatch * BATCH_SIZE + heightOffset
        promises.push(parseCheckpointId(height, rpcSui))
      }

      const records = (await Promise.all(promises)).flat()
      await db('baku_metrics').insert(records)
        .then(() => {
          const range = `${heightBatch * BATCH_SIZE} - ${(heightBatch + 1) * BATCH_SIZE - 1}`
          logger.info(`Checkpoint [${range}], inserted ${records.length} records`)
        })
        .catch(err => logger.error(`Error inserting records: ${err}`))
    }
  }

  else {
    logger.debug(`Latest checkpoint ${bakuCheckpoint}, latest checkpoint in Database ${bakuCheckpointDB}, waiting for new checkpoints...`)
  }

  setTimeout(fetchCheckpoints, 10000)
}



const main = async () => {
  if (!process.env.RPC_BAKU.includes('127.0.0.1'))
    throw new Error('This script is only for local running!')

  fetchCheckpoints()
}

main()
