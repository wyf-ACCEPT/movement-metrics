require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function main() {
  console.log(
    await db('baku_metrics')
      .select('type')
      .count('*')
      .groupBy('type')
      .where('timestamp', '<=', '2024-08-16 01:00:00')
  )
  console.log(
    await db('baku_metrics')
      .count('*')
  )

  db.destroy()
}

main()