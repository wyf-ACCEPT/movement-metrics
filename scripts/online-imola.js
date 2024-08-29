const { Aptos, parseBlockRaw, logger } = require('./parse-imola')
require("dotenv").config()

const BATCH_SIZE = 1000      // 12 min per 1000 blocks

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

const rpcAptos = new Aptos({ fullnode: process.env.RPC_IMOLA, indexer: process.env.INDEXER_IMOLA })


async function fetchBlocks() {
  const imolaBlock = (await rpcAptos.getBlockByVersion({
    ledgerVersion: (await rpcAptos.getIndexerLastSuccessVersion() - 300n)
  })).block_height
  const imolaBlockDB = (await db('imola_metrics').max('block'))[0].max

  if (imolaBlock - imolaBlockDB > BATCH_SIZE + 1) {
    logger.debug(`Latest block ${imolaBlock}, latest block in Database ${imolaBlockDB}, fetching...`)
    const start = parseInt((imolaBlockDB + 1) / BATCH_SIZE)
    const end = parseInt(imolaBlock / BATCH_SIZE)

    for (let heightBatch = start; heightBatch < end; heightBatch++) {
      const promises = []

      for (let heightOffset = 0; heightOffset < BATCH_SIZE; heightOffset++) {
        const height = heightBatch * BATCH_SIZE + heightOffset

        promises.push(
          rpcAptos.getBlockByHeight({
            blockHeight: height, options: { withTransactions: true }
          })
            .then(blockRaw => parseBlockRaw(blockRaw))
            .catch(err => {
              logger.error(`Error fetching block ${height}: ${err}`)
              return []
            }))
      }

      const records = (await Promise.all(promises)).flat()
      await db('imola_metrics').insert(records)
        .then(() => {
          const range = `${heightBatch * BATCH_SIZE} - ${(heightBatch + 1) * BATCH_SIZE - 1}`
          logger.info(`Block [${range}], inserted ${records.length} records`)
        })
        .catch(err => logger.error(`Error inserting records: ${err}`))
    }
  }
  else {
    logger.debug(`Latest block ${imolaBlock}, latest block in Database ${imolaBlockDB}, waiting for new blocks...`)
  }

  setTimeout(fetchBlocks, 3000)
}



const main = async () => {
  if (!process.env.RPC_IMOLA.includes('127.0.0.1'))
    throw new Error('This script is only for local running!')

  fetchBlocks()
}

main()
