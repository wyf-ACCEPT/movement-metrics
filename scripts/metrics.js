const winston = require('winston')
require('dotenv').config()

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
  ],
})


function printStart(start) { return start < '2024-07-22 00:00:00' ? 'Genesis' : start }
function printEnd(end) { return end == 'now()' ? 'Latest' : end }


async function showImolaTotalTxns(start, end) {
  const result = (await
    db(`imola_metrics`)
      .count('*')
      .where('timestamp', '>=', start)
      .andWhere('timestamp', '<=', end)
  )[0].count
  logger.info(
    `[imola] Txns from \x1b[33m${printStart(start)}\x1b[0m to \x1b[33m${printEnd(end)}\x1b[0m: ${result}`
  )
}

async function showBakuTotalTxns(start, end) {
  const result = (await
    db(`baku_metrics`)
      .count('*')
      .where('timestamp', '>=', start)
      .andWhere('timestamp', '<=', end)
      .andWhere('type', '=', 'ProgrammableTransaction')     // System transactions doesn't count
  )[0].count
  logger.info(
    `[baku] Txns from \x1b[33m${printStart(start)}\x1b[0m to \x1b[33m${printEnd(end)}\x1b[0m: ${result}`
  )
}


async function showImolaNewAddress(start, end, interval = 1) {
  const addressSet = new Set()
  const rows = await db('imola_metrics')
    .where('timestamp', '<=', start)
    .select('addresses')
  rows.forEach(row => { row.addresses.forEach(addr => addressSet.add(addr)) })
  addressSet.delete(undefined)
  logger.info(
    `[Imola] Total wallets till \x1b[33m${start}\x1b[0m: ${addressSet.size}`
  )

  let [date, nextDate] = [new Date(start), new Date(start)]
  nextDate.setDate(nextDate.getDate() + interval)

  while (date < new Date(end)) {
    const rows = await db('imola_metrics')
      .where('timestamp', '>=', date)
      .andWhere('timestamp', '<=', nextDate)
      .select('addresses')
    rows.forEach(row => { row.addresses.forEach(addr => addressSet.add(addr)) })
    addressSet.delete(undefined)
    logger.info(
      `[Imola] Total wallets till \x1b[33m${nextDate.toISOString().split('T')[0]}\x1b[0m: ${addressSet.size}`
    )

    date.setDate(date.getDate() + interval)
    nextDate.setDate(nextDate.getDate() + interval)
  }
}


async function showImolaActiveAddress(start, end) {
  const addressSet = new Set()
  const rows = await db('imola_metrics')
    .select('addresses')
    .where('timestamp', '>=', start)
    .andWhere('timestamp', '<=', end)
  rows.forEach(row => { row.addresses.forEach(addr => addressSet.add(addr)) })
  addressSet.delete(undefined)
  logger.info(
    `[Imola] Active wallets from \x1b[33m${printStart(start)}\x1b[0m to \x1b[33m${printEnd(end)}\x1b[0m: ${addressSet.size}`
  )
}

async function showBakuActiveAddress(start, end) {
  const addressSet = new Set()
  const rows = await db('baku_metrics')
    .select('addresses')
    .where('timestamp', '>=', start)
    .andWhere('timestamp', '<=', end)
    .andWhere('type', '=', 'ProgrammableTransaction')     // System transactions doesn't count
  rows.forEach(row => { row.addresses.forEach(addr => addressSet.add(addr)) })
  addressSet.delete(undefined)
  logger.info(
    `[Baku] Active wallets from \x1b[33m${printStart(start)}\x1b[0m to \x1b[33m${printEnd(end)}\x1b[0m: ${addressSet.size}`
  )
}


async function main() {
  console.log(); logger.info("==================================================================")
  const latestImola = (await db('imola_metrics').max('timestamp').where('type', '=', 'block_metadata_transaction'))[0].max
  logger.info(`[Imola] Latest data till ${latestImola}`)
  const latestBaku = (await db('baku_metrics').max('timestamp').where('type', '=', 'ProgrammableTransaction'))[0].max
  logger.info(`[Baku] Latest data till ${latestBaku}`)

  console.log(); logger.info("==================================================================")
  // await showImolaActiveAddress('2024-07-16 00:00:00', '2024-08-05 23:59:59') // 8.5  11:59 PM UTC
  await showImolaActiveAddress('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 01:00 AM UTC (8.15 6PM PT)
  await showBakuActiveAddress('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 01:00 AM UTC (8.15 6PM PT)


  console.log(); logger.info("==================================================================")
  await showImolaTotalTxns('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 1AM UTC
  await showBakuTotalTxns('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 1AM UTC

  console.log(); logger.info("==================================================================")


  // await showImolaTotalTxns('2024-07-16 00:00:00', '2024-07-22 23:59:59')
  // await showImolaTotalTxns('2024-07-23 00:00:00', '2024-07-29 23:59:59')
  // await showImolaTotalTxns('2024-07-30 00:00:00', '2024-08-05 23:59:59')
  // await showImolaTotalTxns('2024-08-06 00:00:00', '2024-08-12 23:59:59')
  // await showImolaTotalTxns('2024-08-13 00:00:00', 'now()')

  // console.log(); logger.info("==================================================================")
  // await showImolaNewAddress('2024-07-22 00:00:00', '2024-08-16 00:00:00', 7)

  // console.log(); logger.info("==================================================================")
  // await showImolaActiveAddress('2024-07-16 00:00:00', '2024-07-22 23:59:59')
  // await showImolaActiveAddress('2024-07-23 00:00:00', '2024-07-29 23:59:59')
  // await showImolaActiveAddress('2024-07-30 00:00:00', '2024-08-05 23:59:59')
  // await showImolaActiveAddress('2024-08-06 00:00:00', '2024-08-12 23:59:59')
  // await showImolaActiveAddress('2024-08-13 00:00:00', 'now()')

  db.destroy()
}

main()