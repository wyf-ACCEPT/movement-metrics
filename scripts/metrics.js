const winston = require('winston')
const { writeFileSync, existsSync } = require('fs')
require('dotenv').config()

const Y = '\x1b[33m'
const R = '\x1b[0m'

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
function printDate(date) {
  return `${date.getFullYear().toString().slice(2)
    }${(date.getMonth() + 1).toString().padStart(2, '0')
    }${(date.getDate()).toString().padStart(2, '0')
    }`
}
function cleanISO(date) {
  return date < '2024-08-10' ? 'Genesis'
    : date.toISOString().slice(0, date.toISOString().length - 5).replace('T', ' ')
}


async function showImolaTotalTxns(start, end) {
  const result = (await
    db(`imola_metrics`)
      .count('*')
      .where('timestamp', '>=', start)
      .andWhere('timestamp', '<=', end)
  )[0].count
  logger.info(
    `[Imola] Txns from ${Y}${printStart(start)}${R} to ${Y}${printEnd(end)}${R}: ${result}`
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
    `[Baku] Txns from ${Y}${printStart(start)}${R} to ${Y}${printEnd(end)}${R}: ${result}`
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
    `[Imola] Total wallets till ${Y}${start}${R}: ${addressSet.size}`
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
      `[Imola] Total wallets till ${Y}${nextDate.toISOString().split('T')[0]}${R}: ${addressSet.size}`
    )

    date.setDate(date.getDate() + interval)
    nextDate.setDate(nextDate.getDate() + interval)
  }
}


async function fillImolaActiveAddressSet(start, end, addressSet = new Set()) {
  const rows = await db('imola_metrics')
    .select('addresses')
    .where('timestamp', '>=', start)
    .andWhere('timestamp', '<=', end)
  rows.forEach(row => { row.addresses.forEach(addr => addressSet.add(addr)) })
  addressSet.delete(undefined)
  return addressSet
}

async function fillBakuActiveAddressSet(start, end, addressSet = new Set()) {
  const rows = await db('baku_metrics')
    .select('addresses')
    .where('timestamp', '>=', start)
    .andWhere('timestamp', '<=', end)
    .andWhere('type', '=', 'ProgrammableTransaction')     // System transactions doesn't count
  rows.forEach(row => { row.addresses.forEach(addr => addressSet.add(addr)) })
  addressSet.delete(undefined)
  return addressSet
}


async function main() {
  console.log(); logger.info("==================================================================")
  const latestImola = (await db('imola_metrics').max('timestamp').where('type', '=', 'block_metadata_transaction'))[0].max
  logger.info(`[Imola] Latest data till ${Y + cleanISO(latestImola) + R}`)
  const latestBaku = (await db('baku_metrics').max('timestamp').where('type', '=', 'ProgrammableTransaction'))[0].max
  logger.info(`[Baku] Latest data till ${Y + cleanISO(latestBaku) + R}`)


  console.log(); logger.info("==================================================================")


  if (!existsSync(`./data/imola-240816.json`)) {
    logger.info()
    logger.info(`[Imola] Setup address set for the first time...`)
    const addressSet = await fillImolaActiveAddressSet('2024-07-22 00:00:00', '2024-08-16 01:00:00')
    writeFileSync(`./data/imola-240816.json`, JSON.stringify([...addressSet], null, 2))
    logger.info(`[Imola] Finished.`)
  }

  for (let date = new Date('2024-08-16 01:00:00'); date < latestImola; date.setDate(date.getDate() + 7)) {
    const imolaFileName = `imola-${printDate(date)}.json`
    let lastDate = new Date(date); lastDate.setDate(lastDate.getDate() - 7)
    logger.info()

    if (existsSync(`./data/${imolaFileName}`)) {
      const addressSet = new Set(require(`../data/${imolaFileName}`))
      logger.info(`[Imola] Address data ${imolaFileName} exists.`)

      logger.info(`[Imola] Active wallets from ${Y + cleanISO(lastDate) + R} to ${Y + cleanISO(date) + R}: ${addressSet.size}`)

    } else {
      const imolaFileLastName = `imola-${printDate(lastDate)}.json`
      logger.info(`[Imola] Address data ${imolaFileName} not found, loading from ${imolaFileLastName}...`)

      let addressSet = new Set(require(`../data/${imolaFileLastName}`))
      addressSet = await fillImolaActiveAddressSet(cleanISO(lastDate), cleanISO(date), addressSet)
      logger.info(`[Imola] Active wallets from ${Y + cleanISO(lastDate) + R} to ${Y + cleanISO(date) + R}: ${addressSet.size}`)

      writeFileSync(`./data/${imolaFileName}`, JSON.stringify([...addressSet], null, 2))
      logger.info(`[Imola] Saved ${addressSet.size} addresses to ${imolaFileName}.`)
    }
  }



  if (!existsSync(`./data/baku-240816.json`)) {
    logger.info()
    logger.info(`[Baku] Setup address set for the first time...`)
    const addressSet = await fillBakuActiveAddressSet('2024-07-22 00:00:00', '2024-08-16 01:00:00')
    writeFileSync(`./data/baku-240816.json`, JSON.stringify([...addressSet], null, 2))
    logger.info(`[Baku] Finished.`)
  }

  for (let date = new Date('2024-08-16 01:00:00'); date < latestBaku; date.setDate(date.getDate() + 7)) {
    const bakuFileName = `baku-${printDate(date)}.json`
    let lastDate = new Date(date); lastDate.setDate(lastDate.getDate() - 7)
    logger.info()

    if (existsSync(`./data/${bakuFileName}`)) {
      const addressSet = new Set(require(`../data/${bakuFileName}`))
      logger.info(`[Baku] Address data ${bakuFileName} exists.`)

      logger.info(`[Baku] Active wallets from ${Y + cleanISO(lastDate) + R} to ${Y + cleanISO(date) + R}: ${addressSet.size}`)

    } else {
      const bakuFileLastName = `baku-${printDate(lastDate)}.json`
      logger.info(`[Baku] Address data ${bakuFileName} not found, loading from ${bakuFileLastName}...`)

      let addressSet = new Set(require(`../data/${bakuFileLastName}`))
      addressSet = await fillBakuActiveAddressSet(cleanISO(lastDate), cleanISO(date), addressSet)
      logger.info(`[Baku] Active wallets from ${Y + cleanISO(lastDate) + R} to ${Y + cleanISO(date) + R}: ${addressSet.size}`)

      writeFileSync(`./data/${bakuFileName}`, JSON.stringify([...addressSet], null, 2))
      logger.info(`[Baku] Saved ${addressSet.size} addresses to ${bakuFileName}.`)
    }
  }



  console.log(); logger.info("==================================================================")

  for (let date = new Date('2024-08-16 01:00:00'); date < latestImola; date.setDate(date.getDate() + 7)) 
    await showImolaTotalTxns('2024-07-16 00:00:00', date.toISOString())

  for (let date = new Date('2024-08-16 01:00:00'); date < latestBaku; date.setDate(date.getDate() + 7))
    await showBakuTotalTxns('2024-07-16 00:00:00', date.toISOString())

  // await showImolaTotalTxns('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 1AM UTC
  // await showImolaTotalTxns('2024-07-16 00:00:00', '2024-08-23 01:00:00') // 8.23 1AM UTC
  // await showImolaTotalTxns('2024-07-16 00:00:00', '2024-08-30 01:00:00') // 8.30 1AM UTC
  // await showImolaTotalTxns('2024-07-16 00:00:00', '2024-09-06 01:00:00') // 9.06 1AM UTC

  // await showBakuTotalTxns('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 1AM UTC
  // await showBakuTotalTxns('2024-07-16 00:00:00', '2024-08-23 01:00:00') // 8.23 1AM UTC
  // await showBakuTotalTxns('2024-07-16 00:00:00', '2024-08-30 01:00:00') // 8.30 1AM UTC

  db.destroy()
}

main()