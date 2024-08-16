const winston = require('winston')
const { formatUnits } = require('ethers')
const {
  Aptos, Account, Ed25519PrivateKey, AccountAddress, PendingTransactionResponse
} = require("@aptos-labs/ts-sdk")
require("dotenv").config()

const rpcAptos = new Aptos({ indexer: process.env.INDEXER_APTOS, fullnode: process.env.RPC_APTOS })

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`),
  ),
  transports: [
    new winston.transports.Console(),
  ],
})

/**
 * @param {Account} sender
 * @param {AccountAddress} to 
 * @param {number} amount 
 * @returns {Promise<PendingTransactionResponse>}
 */
async function simpleTransfer(sender, to, amount) {
  return rpcAptos.transaction.build.simple({
    sender: sender.accountAddress,
    data: {
      function: "0x1::aptos_account::transfer",
      typeArguments: [],
      functionArguments: [to, amount],
    },
  })
    .then(
      txn => rpcAptos.signAndSubmitTransaction({ signer: sender, transaction: txn })
    )
}


const main = async () => {
  const aliceAptos = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(process.env.PRIVATE_KEY_ALICE)
  })
  const aliceAptosAddress = aliceAptos.accountAddress.toString()

  async function showAliceBalances(showAddress = true) {
    if (showAddress)
      logger.info(`Alice address (Aptos): ${aliceAptosAddress}`)
    logger.info(`Alice address (Aptos) Balance: ${formatUnits(
      await rpcAptos.getAccountAPTAmount({ accountAddress: aliceAptosAddress }), 8
    )} 💎`)
  }

  await showAliceBalances(true)

  // for (let i = 0; i < 1; i++) {
  //   const someone = Account.generate()
  //   rpcAptos.transaction.build.simple({
  //     sender: aliceAptos.accountAddress,
  //     data: {
  //       function: "0x1::aptos_account::transfer",
  //       typeArguments: [],
  //       functionArguments: [someone.accountAddress, 100],
  //     },
  //   })
  //     .then(txn => rpcAptos.signAndSubmitTransaction({ signer: aliceAptos, transaction: txn }))
  //     .then(committedTxn => {
  //       logger.info(`Waiting for transaction (${committedTxn.hash}) ...`)
  //       return rpcAptos.waitForTransaction({
  //         transactionHash: committedTxn.hash, options: { timeoutSecs: 60, checkSuccess: true }
  //       })
  //     })
  //     .then(committedTxn => {
  //       logger.info(`Sent 0.000001 APT to ${someone.accountAddress.toString()}`)
  //       logger.info(`View on explorer: https://explorer.devnet.imola.movementlabs.xyz/#/${committedTxn.hash}?network=testnet`)
  //     })
  // }

  // setTimeout(async () => { await showAliceBalances(false) }, 2)

  const someone = Account.generate()
  const intervalId = await simpleTransfer(aliceAptos, someone.accountAddress, 100)
    .then(committedTxn => setInterval(async () => {
      rpcAptos.getTransactionByHash({ transactionHash: committedTxn.hash })
        .then(result => {
          if (result.type === 'user_transaction') {
            logger.info(`Transaction succeeded: ${result.hash}`)
            logger.info(`View on explorer: https://explorer.devnet.imola.movementlabs.xyz/#/txn/${result.hash}?network=testnet`)
            clearInterval(intervalId)
          } else if (result.type === 'pending_transaction') {
            logger.info('Transaction not yet confirmed, retrying...')
          } else {
            logger.error(`Error fetching transaction: ${result}`)
          }
        })
        .catch(error => {
          logger.error('Error fetching transaction:', error)
        })
    }, 5000))

  // logger.info(`View on explorer: https://explorer.devnet.imola.movementlabs.xyz/#/${committedTxn.hash}?network=testnet`)


}

main()
