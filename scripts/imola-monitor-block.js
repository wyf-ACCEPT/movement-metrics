const { AptosWithRetries, logger } = require('./utils')
require("dotenv").config()

const rpcAptos = new AptosWithRetries({ indexer: process.env.INDEXER_IMOLA, fullnode: process.env.RPC_IMOLA })

const main = async () => {

  // console.log(await rpcAptos.getBlockByVersion({ ledgerVersion: 33397000 }))

  const imolaTxns = (await rpcAptos.getIndexerLastSuccessVersion()) - 1000n
  let currentHeight = (await rpcAptos.getBlockByVersion({ ledgerVersion: imolaTxns })).block_height

  while (1) {
    let fetchFlag = false
    const imolaTxns = (await rpcAptos.getIndexerLastSuccessVersion()) - 1000n   // Avoid rpc not up-to-date
    const latestHeight = (await rpcAptos.getBlockByVersion({ ledgerVersion: imolaTxns })).block_height
    while (currentHeight <= latestHeight) {
      const block = await rpcAptos.getBlockByHeight({
        blockHeight: currentHeight, options: { withTransactions: true },
      })
      logger.info(`Block ${currentHeight++}, total ${block.transactions.length} txns`)
      fetchFlag = true
    }
    if (!fetchFlag) {
      logger.debug(`No new block, waiting for 1.5s ...`)
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }
}

main()
