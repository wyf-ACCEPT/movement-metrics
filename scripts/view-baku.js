require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function main() {
  console.log(
    await db('baku_metrics')
      .select('*')
      .whereNotNull('timestamp')
      .orderBy('timestamp', 'desc')
      .limit(1)
  )
  console.log(
    await db('baku_metrics')
      .select('type')
      .count('*')
      .groupBy('type')
  )
  console.log(
    await db('baku_metrics')
      .count('*')
  )

  db.destroy()
}

main()