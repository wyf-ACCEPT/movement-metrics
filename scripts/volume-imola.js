const winston = require('winston')
const BigNumber = require('bignumber.js')
const { TransactionResponseType, Block, AnyNumber } = require("@aptos-labs/ts-sdk")
const { Aptos } = require('./parse-imola')
require("dotenv").config()

const BATCH_SIZE = 3000
const FAUCET_APTOS = '0x43f1fa2559bb529ea189b4d582532306be79a5fe7b33a4f1fffc29b33aa18e42'
const FAUCET_MEVM = '0xa4ca13309eb1b74344928a3ba008ce2cba9dacaac2354a83cd2021f4a78ce455'

function emptyRecords() {
  return {
    faucetTxnsAptos: 0,
    faucetTxnsMevm: 0,
    faucetAccountsAptos: 0,
    faucetAccountsMevm: 0,
    functions: {},
    gasFee: 0,
    gasUnitPrices: {},
  }
}


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
    new winston.transports.Console({ level: 'debug' }),
  ],
})


/**
 * @param {Date} date 
 * @returns {Promise<[number, number]>}
 */
async function fetchDateBlockRange(date) {
  const blockStart = (await db('imola_metrics')
    .min('block')
    .where('timestamp', '>', date))[0].min
  const newDate = new Date(date)
  newDate.setDate(newDate.getDate() + 1)
  const blockEnd = (await db('imola_metrics')
    .max('block')
    .where('timestamp', '<', newDate))[0].max
  return [blockStart, blockEnd]
}


/**
 * @param {Block} blockRaw 
 */
function parseMoveTokenRelated(blockRaw, records) {

  return blockRaw.transactions === null ? [] : blockRaw.transactions
    .filter(txn => txn.type != TransactionResponseType.Pending)
    .map(txn => {

      if (txn.payload != undefined && txn.payload.function != undefined) {
        // Function types
        const f = txn.payload.function
        if (records.functions[f] == undefined) records.functions[f] = 1
        else records.functions[f]++

        // Faucet to Aptos account
        if (f == '0x1::aptos_account::batch_transfer' && txn.sender == FAUCET_APTOS) {
          records.faucetTxnsAptos++; records.faucetAccountsAptos += txn.payload.arguments[0].length
        }

        // Faucet to EVM account
        if (f == '0x1::evm::batch_deposit' && txn.sender == FAUCET_MEVM) {
          records.faucetTxnsMevm++; records.faucetAccountsMevm += txn.payload.arguments[0].length
        }

        // Gas fee
        if (records.gasUnitPrices[txn.gas_unit_price] == undefined)
          records.gasUnitPrices[txn.gas_unit_price] = 1
        else records.gasUnitPrices[txn.gas_unit_price]++
        records.gasFee += txn.gas_used * txn.gas_unit_price
      }
    })
}


const main = async () => {
  if (!process.env.RPC_IMOLA.includes('127.0.0.1'))
    throw new Error('This script is only for local running!')

  const rpcAptos = new Aptos({ fullnode: process.env.RPC_IMOLA, indexer: process.env.INDEXER_IMOLA })

  const currentDate = new Date('2024-08-01')
  const tillDate = new Date('2024-09-04')
  const dateRecords = {}
  
  while (currentDate < tillDate) {

    const [startBlock, endBlock] = await fetchDateBlockRange(currentDate)
    const currentDateString = currentDate.toISOString().slice(0, 10)

    logger.info(`Fetching blocks from ${startBlock} to ${endBlock}, on ${currentDateString}.`)

    const records = emptyRecords()

    for (
      let heightBatch = Math.floor(startBlock / BATCH_SIZE);
      heightBatch < Math.ceil(endBlock / BATCH_SIZE);
      heightBatch++
    ) {
      const promises = []

      for (let heightOffset = 0; heightOffset < BATCH_SIZE; heightOffset++) {
        const height = heightBatch * BATCH_SIZE + heightOffset
        if (height < startBlock || height > endBlock) continue
        promises.push(rpcAptos.getBlockByHeight({
          blockHeight: height, options: { withTransactions: true }
        })
          .then(blockRaw => parseMoveTokenRelated(blockRaw, records))
          .catch(err => {
            logger.error(`Error fetching block ${height}: ${err}`)
            return []
          }))
      }

      await Promise.all(promises)

      const range = `${heightBatch * BATCH_SIZE} - ${(heightBatch + 1) * BATCH_SIZE - 1}`
      const left = parseInt((endBlock - heightBatch * BATCH_SIZE) / 1000) * 1000
      logger.debug(`Block [${range}] parsed, left ${left} blocks.`)

    }

    dateRecords[currentDateString] = records
    currentDate.setDate(currentDate.getDate() + 1)
    logger.info(`Finished parsing ${currentDateString}`)
  }

  require('fs').writeFileSync(
    './data/move-volume.json', 
    JSON.stringify(dateRecords, null, 2),
  )

  await db.destroy()
}

if (require.main === module) {
  main();
}
