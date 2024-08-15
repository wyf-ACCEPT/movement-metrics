const winston = require('winston')
const { Aptos, TransactionResponseType, Block, } = require("@aptos-labs/ts-sdk")
require("dotenv").config()

const BATCH_SIZE = 1000
const EPOCH = 4600

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/imola-parsing.log', format: winston.format.simple()
    })
  ],
})

/**
 * @param {Block} blockRaw 
 * @returns {[number, number, string, string, string[]][]}
 */
function parseBlockRaw(blockRaw) {
  return blockRaw.transactions === null ? [] : blockRaw.transactions
    .filter(txn => txn.type != TransactionResponseType.Pending)
    .map(txn => {
      const addressList = txn.changes
        .filter(change => change.type === 'write_resource' && change.address != '0x1')
        .map(change => change.address)
      const addressListUnique = [...new Set(addressList)]
      const timestampOpt = typeof (txn.timestamp) === 'string' ?
        new Date(txn.timestamp / 1000) : null
      return {
        hash: txn.hash,
        type: txn.type,
        block: parseInt(blockRaw.block_height),
        version: parseInt(txn.version),
        timestamp: timestampOpt,
        addresses: addressListUnique,
      }
    })
}

const main = async () => {
  const rpcAptos = new Aptos({ fullnode: process.env.RPC_APTOS })

  for (let heightBatch = 0; heightBatch < EPOCH; heightBatch++) {
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

  await db.destroy()
}

main()
