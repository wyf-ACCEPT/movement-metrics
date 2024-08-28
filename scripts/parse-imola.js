const winston = require('winston')
const BigNumber = require('bignumber.js')
const { Aptos: OriginalAptos, TransactionResponseType, Block, AnyNumber } = require("@aptos-labs/ts-sdk")
require("dotenv").config()

const BATCH_SIZE = 1000
const START = 5700
const END = 5700


const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console({ 
      level: 'debug',
    }),
    new winston.transports.File({
      level: 'info', 
      format: winston.format.simple(),
      filename: 'logs/imola-parsing.log',
    }),
    new winston.transports.File({
      level: 'debug',
      format: winston.format.simple(),
      filename: 'logs/imola-online.log',
    }),
  ],
})


// Rewrite `getBlockByHeight` method to fetch all transactions in a block
class Aptos extends OriginalAptos {
  /**
   * @param {{blockHeight: AnyNumber, options?: {withTransactions?: boolean}}} args 
   * @returns {Promise<Block>}
   */
  async getBlockByHeight(args) {
    if (!args.options || !args.options.withTransactions) {
      return super.getBlockByHeight(args)
    }
    const block = await super.getBlockByHeight(args)
    const fetchCount = block.transactions.length
    let count = BigNumber(block.last_version).minus(block.first_version).toNumber() - fetchCount + 1
    if (count > 0) {
      block.transactions.push(
        ...(await Promise.all(
          Array(count)
            .fill()
            .map((_, i) => {
              return super.getTransactionByVersion({
                ledgerVersion: BigNumber(block.first_version)
                  .plus(fetchCount + i)
                  .toFixed(0),
              })
            }),
        )),
      )
    }
    return block
  }
}


/**
 * @param {Block} blockRaw 
 * @returns {[string, string, number, number, Date, string[]][]}
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
  if (!process.env.RPC_IMOLA.includes('127.0.0.1'))
    throw new Error('This script is only for local running!')
  
  const rpcAptos = new Aptos({ fullnode: process.env.RPC_IMOLA, indexer: process.env.INDEXER_IMOLA })

  for (let heightBatch = START; heightBatch < END; heightBatch++) {
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

if (require.main === module) {
  main();
}


module.exports = {
  Aptos,
  logger,
  parseBlockRaw,
}
