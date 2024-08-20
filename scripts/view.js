require('dotenv').config()

const db = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
})

async function main() {
  console.log(
    await db('imola_metrics')

      // .select('type')
      // .count('*')
      // .groupBy('type')

      .select('*')
      .orderBy('timestamp', 'desc')
      .limit(5)

      // .select('block')
      // .count('*')
      // .groupBy('block')
      // .having(db.raw('count(*) >= ?', [100]))
      // .limit(5)
  )

  db.destroy()
}

main()