const { AptosWithRetries, logger } = require('./utils')
require("dotenv").config()

const rpcAptos = new AptosWithRetries({ indexer: process.env.INDEXER_IMOLA, fullnode: process.env.RPC_IMOLA })

const main = async () => {

  const imolaTxns = await rpcAptos.getIndexerLastSuccessVersion()
  let currentHeight = (await rpcAptos.getBlockByVersion({ ledgerVersion: imolaTxns })).block_height

  while (1) {
    let fetchFlag = false
    const imolaTxns = await rpcAptos.getIndexerLastSuccessVersion()
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
