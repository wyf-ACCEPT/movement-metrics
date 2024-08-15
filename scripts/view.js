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
      .orderBy('timestamp', 'asc')
      .limit(5)
  )
  // console.log(
  //   await db('imola_metrics')
  //     .select('*')
  //     .limit(5)
  // )

  db.destroy()
}

main()