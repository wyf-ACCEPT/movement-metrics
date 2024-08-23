const winston = require('winston')
const { writeFileSync, existsSync } = require('fs')
require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

const logger = winston.createLogger({
  level: 'debug',
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
    `[Imola] Txns from \x1b[33m${printStart(start)}\x1b[0m to \x1b[33m${printEnd(end)}\x1b[0m: ${result}`
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
    `[Baku] Txns from \x1b[33m${printStart(start)}\x1b[0m to \x1b[33m${printEnd(end)}\x1b[0m: ${result}`
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


async function showImolaActiveAddress(start, end, addressSet = new Set()) {
  const rows = await db('imola_metrics')
    .select('addresses')
    .where('timestamp', '>=', start)
    .andWhere('timestamp', '<=', end)
  rows.forEach(row => { row.addresses.forEach(addr => addressSet.add(addr)) })
  addressSet.delete(undefined)
  logger.info(
    `[Imola] Active wallets from \x1b[33m${printStart(start)}\x1b[0m to \x1b[33m${printEnd(end)}\x1b[0m: ${addressSet.size}`
  )
  return addressSet
}

async function showBakuActiveAddress(start, end, addressSet = new Set()) {
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
  return addressSet
}


async function main() {
  console.log(); logger.info("==================================================================")
  const latestImola = (await db('imola_metrics').max('timestamp').where('type', '=', 'block_metadata_transaction'))[0].max
  logger.info(`[Imola] Latest data till ${latestImola}`)
  const latestBaku = (await db('baku_metrics').max('timestamp').where('type', '=', 'ProgrammableTransaction'))[0].max
  logger.info(`[Baku] Latest data till ${latestBaku}`)

  
  console.log(); logger.info("==================================================================")

  let setCacheImola
  let imolaName = 'imola-240816.json'
  if (existsSync(`./data/${imolaName}`)) {
    logger.debug(`Loading existing data from ${imolaName} ...`)
    setCacheImola = new Set(require(`../data/${imolaName}`))
    logger.debug(`Loaded ${setCacheImola.size} addresses.`)
  } else {
    logger.debug(`Fetching raw data ...`)
    setCacheImola = await showImolaActiveAddress('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 01:00 AM UTC (8.15 6PM PT)
    writeFileSync(`./data/${imolaName}`, JSON.stringify([...setCacheImola], null, 2))
    logger.debug(`Saved ${setCacheImola.size} addresses to ${imolaName}.`)
  }

  await showImolaActiveAddress('2024-08-16 01:00:00', '2024-08-23 01:00:00', setCacheImola) // 8.23 01:00 AM UTC (8.22 6PM PT)


  let setCacheBaku
  let bakuName = 'baku-240816.json'
  if (existsSync(`./data/${bakuName}`)) {
    logger.debug(`Loading existing data from ${bakuName} ...`)
    setCacheBaku = new Set(require(`../data/${bakuName}`))
    logger.debug(`Loaded ${setCacheBaku.size} addresses.`)
  } else {
    logger.debug(`Fetching raw data ...`)
    setCacheBaku = await showBakuActiveAddress('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 01:00 AM UTC (8.15 6PM PT)
    writeFileSync(`./data/${bakuName}`, JSON.stringify([...setCacheBaku], null, 2))
    logger.debug(`Saved ${setCacheBaku.size} addresses to ${bakuName}.`)
  }

  // await showBakuActiveAddress('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 01:00 AM UTC (8.15 6PM PT)
  const setNew = await showBakuActiveAddress('2024-08-16 01:00:00', '2024-08-23 01:00:00', setCacheBaku) // 8.23 01:00 AM UTC (8.22 6PM PT)
  writeFileSync(`./data/baku-240823.json`, JSON.stringify([...setNew], null, 2))


  console.log(); logger.info("==================================================================")

  await showImolaTotalTxns('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 1AM UTC
  await showImolaTotalTxns('2024-07-16 00:00:00', '2024-08-23 01:00:00') // 8.23 1AM UTC

  await showBakuTotalTxns('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 1AM UTC
  await showBakuTotalTxns('2024-07-16 00:00:00', '2024-08-23 01:00:00') // 8.23 1AM UTC


  // console.log(); logger.info("==================================================================")
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