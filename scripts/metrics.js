require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function countTimeframe(start, end) {
  return (await db('imola_metrics')
    .count('*')
    .where('timestamp', '>=', start)
    .andWhere('timestamp', '<=', end))[0].count
}

async function showCountTimeframe(start, end) {
  startPrint = start < '2024-07-22 00:00:00' ? 'Genesis' : start
  console.log(
    `Txns from \x1b[33m${startPrint}\x1b[0m to \x1b[33m${end}\x1b[0m: ${await countTimeframe(start, end)}`
  )
}


async function showCountNewAddress(start, end) {
  const addressSet = new Set()
  const rows = await db('imola_metrics')
    .where('timestamp', '<=', start)
    .select('addresses')
  rows.forEach(row => { addressSet.add(...row.addresses) })
  addressSet.delete(undefined)
  console.log(
    `Total wallets till \x1b[33m${start}\x1b[0m: ${addressSet.size}`
  )

  let [date, nextDate] = [new Date(start), new Date(start)]
  nextDate.setDate(nextDate.getDate() + 1)

  while (date < new Date(end)) {
    const rows = await db('imola_metrics')
      .where('timestamp', '>=', date)
      .andWhere('timestamp', '<=', nextDate)
      .select('addresses')
    rows.forEach(row => { addressSet.add(...row.addresses) })
    addressSet.delete(undefined)
    console.log(
      `Total wallets till \x1b[33m${nextDate.toISOString().split('T')[0]}\x1b[0m: ${addressSet.size}`
    )

    date.setDate(date.getDate() + 1)
    nextDate.setDate(nextDate.getDate() + 1)
  }
}


async function showActiveAddress(start, end) {
  const addressSet = new Set()
  const rows = await db('imola_metrics')
    .where('timestamp', '>=', start)
    .andWhere('timestamp', '<=', end)
    .select('addresses')
  rows.forEach(row => { addressSet.add(...row.addresses) })
  addressSet.delete(undefined)
  startPrint = start < '2024-07-22 00:00:00' ? 'Genesis' : start
  console.log(
    `Active wallets from \x1b[33m${startPrint}\x1b[0m to \x1b[33m${end}\x1b[0m: ${addressSet.size}`
  )
}


async function main() {
  console.log("\n==================================================================")
  await showActiveAddress('2024-07-16 00:00:00', '2024-08-05 23:59:59') // 8.5 11:59:59 PM UTC
  await showActiveAddress('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 1AM UTC

  console.log("\n==================================================================")
  // console.log("Total txns: ", (await db('imola_metrics').count('*'))[0].count)
  await showCountTimeframe('2024-07-16 00:00:00', '2024-08-16 01:00:00') // 8.16 1AM UTC

  await showCountTimeframe('2024-07-16 00:00:00', '2024-07-22 23:59:59')
  await showCountTimeframe('2024-07-23 00:00:00', '2024-07-29 23:59:59')
  await showCountTimeframe('2024-07-30 00:00:00', '2024-08-05 23:59:59')
  await showCountTimeframe('2024-08-06 00:00:00', '2024-08-12 23:59:59')
  await showCountTimeframe('2024-08-13 00:00:00', 'now()')

  console.log("\n==================================================================")
  await showActiveAddress('2024-07-16 00:00:00', '2024-07-22 23:59:59')
  await showActiveAddress('2024-07-23 00:00:00', '2024-07-29 23:59:59')
  await showActiveAddress('2024-07-30 00:00:00', '2024-08-05 23:59:59')
  await showActiveAddress('2024-08-06 00:00:00', '2024-08-12 23:59:59')
  await showActiveAddress('2024-08-13 00:00:00', 'now()')

  console.log("\n==================================================================")
  await showCountNewAddress('2024-07-22 00:00:00', '2024-08-13 00:00:00')

  db.destroy()
}

main()