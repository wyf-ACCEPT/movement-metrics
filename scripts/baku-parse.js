const winston = require('winston')
const { getFullnodeUrl, SuiClient } = require('@mysten/sui/client')
require('dotenv').config()

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
    }),
  ],
})

const main = async () => {
  const rpcUrl = process.env.RPC_BAKU
  const client = new SuiClient({ url: rpcUrl })
  console.log(await client.getLatestCheckpointSequenceNumber())
  console.log(await client.getTotalTransactionBlocks())
  console.log(await client.getCheckpoint({ id: "9430000" }))
  // const { cp: cpStart, txns: txnsStart } = await findCheckpoint("2024-08-06T00:00:00Z", client)
  // const { cp: cpEnd, txns: txnsEnd } = await findCheckpoint("2024-08-12T23:59:59Z", client)
  // console.log(`\n${INFO} Checkpoint range: ${cpStart} - ${cpEnd} (total ${cpEnd - cpStart} checkpoints)`)
  // console.log(`${INFO} Transaction range: ${txnsStart} - ${txnsEnd} (total ${txnsEnd - txnsStart} transactions)`)
}

main()