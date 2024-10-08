const winston = require('winston')
const {
  SuiClient: OriginSuiClient, SuiTransactionBlockResponse,
  MultiGetTransactionBlocksParams, GetCheckpointParams, Checkpoint,
} = require('@mysten/sui/client')
const { writeFileSync } = require('fs')
require('dotenv').config()

const BATCH_SIZE = 100
const START = 100000
const END = 107200


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
      filename: 'logs/baku-parsing.log',
    }),
    new winston.transports.File({
      level: 'debug',
      format: winston.format.simple(),
      filename: 'logs/baku-online.log',
    }),
  ],
})


// Rewrite `multiGetTransactionBlocks` method to fetch all transactions in a request
class SuiClient extends OriginSuiClient {

  #retries = 10
  #interval = 60_000

  /**
   * @return {Promise<string>}
   */
  async getLatestCheckpointSequenceNumber() {
    return super.getLatestCheckpointSequenceNumber()
      .then(response => response)
      .catch(async error => {
        if (error.toString() == 'TypeError: fetch failed' && this.#retries > 0) {
          logger.warn('Retrying getLatestCheckpointSequenceNumber...')
          return new Promise(resolve => setTimeout(resolve, this.#interval))
            .then(() => this.getLatestCheckpointSequenceNumber(this.#retries - 1))
        } else this.#logError(error)
      })
  }

  /**
   * @param {GetCheckpointParams} input
   * @return {Promise<Checkpoint>}
   */
  async getCheckpoint(input) {
    return super.getCheckpoint(input)
      .then(response => response)
      .catch(async error => {
        if (error.toString() == 'TypeError: fetch failed' && this.#retries > 0) {
          logger.warn(`Retrying getCheckpoint(${input.id})...`)
          return new Promise(resolve => setTimeout(resolve, this.#interval))
            .then(() => this.getCheckpoint(input, this.#retries - 1))
        } else this.#logError(error)
      })
  }

  /**
   * @param {MultiGetTransactionBlocksParams} input
   * @return {Promise<SuiTransactionBlockResponse[]>}
   */
  async _multiGetTransactionBlocksWithRetries(input) {
    return super.multiGetTransactionBlocks(input)
      .then(response => response)
      .catch(async error => {
        if (error.toString() == 'TypeError: fetch failed' && this.#retries > 0) {
          logger.warn(`Retrying multiGetTransactionBlocks(${input.digests.length})...`)
          return new Promise(resolve => setTimeout(resolve, this.#interval))
            .then(() => this._multiGetTransactionBlocksWithRetries(input, this.#retries - 1))
        } else this.#logError(error)
      })
  }

  /**
   * @param {MultiGetTransactionBlocksParams} input
   * @returns {Promise<SuiTransactionBlockResponse[]>}
   */
  async multiGetTransactionBlocks(input) {
    if (input.digests.length <= 50)
      return this._multiGetTransactionBlocksWithRetries(input)
    else {
      const responsePromises = []
      for (let i = 0; i < input.digests.length; i += 50) {
        responsePromises.push(
          this._multiGetTransactionBlocksWithRetries({
            digests: input.digests.slice(i, i + 50),
            options: input.options,
          })
        )
      }
      return Promise.all(responsePromises)
        .then(responses => responses.flat())
    }
  }


  /**
   * @param {error} err
   */
  #logError(err) {
    logger.error(`[START]${err.toString()}[END]`)
    logger.error(`Error message: [START]${err.message}[END]`)
    writeFileSync('./logs/latest-error.log', JSON.stringify(err))
    throw err
  }
}



/**
 * @param {number} cpId 
 * @param {SuiClient} suiClient
 * @returns {Promise<[string, number, number, Date, string[]][]>}
 */
async function parseCheckpointId(cpId, suiClient) {
  return suiClient.getCheckpoint({ id: cpId.toString() })
    .then(checkpoint => suiClient.multiGetTransactionBlocks({
      digests: checkpoint.transactions,
      options: { showEffects: true, showInput: true },
    }))
    .then(responses => responses.map(response => {
      const addressSet = new Set()
      if (response.effects.mutated)
        response.effects.mutated.forEach(change => addressSet.add(change.owner.AddressOwner))
      if (response.effects.created)
        response.effects.created.forEach(change => addressSet.add(change.owner.AddressOwner))
      addressSet.delete(undefined)
      return {
        digest: response.digest,
        type: response.transaction.data.transaction.kind,
        checkpoint: parseInt(response.checkpoint),
        epoch: parseInt(response.effects.executedEpoch),
        timestamp: new Date(parseInt(response.timestampMs)),
        addresses: [...addressSet],
      }
    }))
}


const main = async () => {
  if (!process.env.RPC_BAKU.includes('127.0.0.1'))
    throw new Error('This script is only for local running!')

  const rpcSui = new SuiClient({ url: process.env.RPC_BAKU })

  for (let heightBatch = START; heightBatch < END; heightBatch++) {
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

  await db.destroy()
}

if (require.main === module) {
  main();
}


module.exports = {
  SuiClient,
  logger,
  parseCheckpointId,
}