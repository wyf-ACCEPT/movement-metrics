const winston = require('winston')
const BigNumber = require('bignumber.js')
const { Aptos: OriginalAptos, Block, AnyNumber } = require("@aptos-labs/ts-sdk")
require("dotenv").config()

class Aptos extends OriginalAptos {
  /**
   * @param {{blockHeight: AnyNumber, options?: {withTransactions?: boolean}}} args 
   * @returns {Promise<Block>}
   */
  async getBlockByHeight(args) {
    if (!args.options || !args.options.withTransactions) {
      return super.getBlockByHeight(args)
    }
    const block = await super.getBlockByHeight(args)
    const fetchCount = block.transactions.length
    let count = BigNumber(block.last_version).minus(block.first_version).toNumber() - fetchCount + 1
    if (count > 0) {
      block.transactions.push(
        ...(await Promise.all(
          Array(count)
            .fill()
            .map((_, i) => {
              return super.getTransactionByVersion({
                ledgerVersion: BigNumber(block.first_version)
                  .plus(fetchCount + i)
                  .toFixed(0),
              })
            }),
        )),
      )
    }
    return block
  }
}

const main = async () => {
  const rpcAptos = new Aptos({ fullnode: process.env.RPC_IMOLA })

  // console.log(await rpcAptos.getBlockByHeight({
  //   blockHeight: 400, options: { withTransactions: true }
  // }))

  console.log(await rpcAptos.getLedgerInfo())
}

main()
