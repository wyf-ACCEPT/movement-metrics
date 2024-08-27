const winston = require('winston')
const { SuiClient, Checkpoint, SuiTransactionBlockResponse, MultiGetTransactionBlocksParams } = require('@mysten/sui/client')
const { Aptos } = require("@aptos-labs/ts-sdk")
require('dotenv').config()

const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

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
  transports: [new winston.transports.Console()],
})


const main = async () => {
  const rpcSui = new SuiClient({ url: process.env.RPC_BAKU })
  const rpcAptos = new Aptos({ fullnode: process.env.RPC_IMOLA, indexer: process.env.INDEXER_IMOLA })

  const bakuTxns = await rpcSui.getTotalTransactionBlocks()
  const bakuTxnsDB = (await db('baku_metrics').count('*'))[0].count
  const bakuPct = (parseInt(bakuTxnsDB) / parseInt(bakuTxns) * 100).toFixed(2)
  logger.info(`Total txns Baku: ${bakuTxns}`)
  logger.info(`Total txns Baku DB: ${bakuTxnsDB} (${bakuPct}%)`)

  const bakuCheckpoint = await rpcSui.getLatestCheckpointSequenceNumber()
  const bakuCheckpointDB = (await db('baku_metrics').max('checkpoint'))[0].max
  logger.info(`Total checkpoints Baku: ${bakuCheckpoint}`)
  logger.info(`Total checkpoints Baku DB: ${YELLOW}${(bakuCheckpointDB + 1) / 100}${RESET} * 100 - 1`)
  logger.info(`Latest record in Baku DB: ${(await db('baku_metrics').max('timestamp'))[0].max}\n`)

  const imolaTxns = await rpcAptos.getIndexerLastSuccessVersion()
  const imolaTxnsDB = (await db('imola_metrics').count('*'))[0].count
  const imolaPct = (parseInt(imolaTxnsDB) / parseInt(imolaTxns) * 100).toFixed(2)
  logger.info(`Total txns Imola: ${imolaTxns}`)
  logger.info(`Total txns Imola DB: ${imolaTxnsDB} (${imolaPct}%)`)

  const imolaBlock = (await rpcAptos.getBlockByVersion({ ledgerVersion: imolaTxns })).block_height
  const imolaBlockDB = (await db('imola_metrics').max('block'))[0].max
  logger.info(`Total blocks Imola: ${imolaBlock}`)
  logger.info(`Total blocks Imola DB: ${YELLOW}${(imolaBlockDB + 1) / 1000}${RESET} * 1000 - 1`)

  logger.info(`Latest record in Imola DB: ${(await db('imola_metrics').max('timestamp'))[0].max}\n`)


  db.destroy()
}

main()