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



async function countTimeframe(start, end) {
  return (await db('imola_metrics')
    .count('*')
    .where('timestamp', '>=', start)
    .andWhere('timestamp', '<=', end))[0].count
}

async function showCountTimeframe(start, end) {
  const startPrint = start < '2024-07-22 00:00:00' ? 'Genesis' : start
  const endPrint = end == 'now()' ? 'Latest' : end
  logger.info(
    `Txns from \x1b[33m${startPrint}\x1b[0m to \x1b[33m${endPrint}\x1b[0m: ${await countTimeframe(start, end)}`
  )
}


async function showCountNewAddress(start, end, interval=1) {
  const addressSet = new Set()
  const rows = await db('imola_metrics')
    .where('timestamp', '<=', start)
    .select('addresses')
  rows.forEach(row => { row.addresses.forEach(addr => addressSet.add(addr)) })
  addressSet.delete(undefined)
  logger.info(
    `Total wallets till \x1b[33m${start}\x1b[0m: ${addressSet.size}`
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
      `Total wallets till \x1b[33m${nextDate.toISOString().split('T')[0]}\x1b[0m: ${addressSet.size}`
    )

    date.setDate(date.getDate() + interval)
    nextDate.setDate(nextDate.getDate() + interval)
  }
}


async function showActiveAddress(start, end) {
  const addressSet = new Set()
  const rows = await db('imola_metrics')
    .where('timestamp', '>=', start)
    .andWhere('timestamp', '<=', end)
    .select('addresses')
  rows.forEach(row => { row.addresses.forEach(addr => addressSet.add(addr)) })
  addressSet.delete(undefined)
  const startPrint = start < '2024-07-22 00:00:00' ? 'Genesis' : start
  const endPrint = end == 'now()' ? 'Latest' : end
  logger.info(
    `Active wallets from \x1b[33m${startPrint}\x1b[0m to \x1b[33m${endPrint}\x1b[0m: ${addressSet.size}`
  )
}


async function main() {
  const latest = await db('imola_metrics').select('*').whereNotNull('timestamp').orderBy('timestamp', 'desc').limit(1)
  logger.info(`Latest data till ${latest[0].timestamp}`)

  console.log(); logger.info("==================================================================")
  await showActiveAddress('2024-07-16 00:00:00', '2024-08-05 23:59:59') // 8.5 11:59:59 PM UTC
  await showActiveAddress('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 1AM UTC

  console.log(); logger.info("==================================================================")
  await showActiveAddress('2024-07-16 00:00:00', '2024-07-22 23:59:59')
  await showActiveAddress('2024-07-23 00:00:00', '2024-07-29 23:59:59')
  await showActiveAddress('2024-07-30 00:00:00', '2024-08-05 23:59:59')
  await showActiveAddress('2024-08-06 00:00:00', '2024-08-12 23:59:59')
  await showActiveAddress('2024-08-13 00:00:00', 'now()')

  console.log(); logger.info("==================================================================")
  await showCountTimeframe('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 1AM UTC

  await showCountTimeframe('2024-07-16 00:00:00', '2024-07-22 23:59:59')
  await showCountTimeframe('2024-07-23 00:00:00', '2024-07-29 23:59:59')
  await showCountTimeframe('2024-07-30 00:00:00', '2024-08-05 23:59:59')
  await showCountTimeframe('2024-08-06 00:00:00', '2024-08-12 23:59:59')
  await showCountTimeframe('2024-08-13 00:00:00', 'now()')

  console.log(); logger.info("==================================================================")
  await showCountNewAddress('2024-07-22 00:00:00', '2024-08-16 00:00:00', 7)

  db.destroy()
}

main()