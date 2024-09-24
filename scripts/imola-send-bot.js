const { formatUnits, parseUnits } = require('ethers')
const {
  Account, Ed25519PrivateKey, AccountAddress, PendingTransactionResponse, HexInput,
} = require("@aptos-labs/ts-sdk")
const { AptosWithRetries, logger } = require('./utils')
require("dotenv").config()

const rpcAptos = new AptosWithRetries({ indexer: process.env.INDEXER_IMOLA, fullnode: process.env.RPC_IMOLA })

/**
 * @param {Account} account
 * @returns {string}
 */
function explorerAddress(account) {
  return `https://explorer.devnet.imola.movementlabs.xyz/#/account/${account.accountAddress.toString()}?network=testnet`
}

/**
 * @param {string} hash
 * @returns {string}
 */
function explorerTxn(hash) {
  return `https://explorer.devnet.imola.movementlabs.xyz/#/txn/${hash}?network=testnet`
}

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
      expireTimestamp: Date.now() / 1000 + 1_000,
    },
    options: {
      gasUnitPrice: 500,
    }
  })
    .then(
      txn => rpcAptos.signAndSubmitTransaction({ signer: sender, transaction: txn })
    )
}


/**
 * 
 * @param {HexInput} hash 
 * @param {number} interval 
 * @returns {Promise<PendingTransactionResponse>}
 */
async function waitForTransactionConfirmation(hash, interval) {
  return new Promise((resolve, reject) => {
    const checkTransaction = () => {
      rpcAptos.getTransactionByHash({ transactionHash: hash })
        .then(result => {
          if (result.type === 'user_transaction') {
            resolve(result)
          } else if (result.type === 'pending_transaction') {
            // logger.silly('Transaction not yet confirmed, retrying...')
            setTimeout(checkTransaction, interval)
          } else {
            reject(`Error result type: ${result}`)
          }
        })
        .catch(error => {
          reject(`Error fetching transaction: ${error}`)
        })
    }
    checkTransaction()
  })
}


/**
 * 
 * @param {Account} sender 
 * @param {Account} to 
 * @param {number} amount 
 * @param {number} interval 
 * @param {number | string} idx1 
 * @param {number | string} idx2 
 * @param {undefined | Account[]} newAccounts
 * @returns {Promise<void>}
 */
async function transferAndWait(sender, to, amount, interval, idx1, idx2, newAccounts) {
  let formattedAmount = formatUnits(amount, 8)
  return simpleTransfer(sender, to.accountAddress, amount)
    .then(committedTxn => waitForTransactionConfirmation(committedTxn.hash, interval))
    .then(result => {
      logger.info(`Transfer [${idx1} -> ${idx2} (${formattedAmount} $APT)] succeeded: ${explorerTxn(result.hash)}`)
      if (newAccounts !== undefined) newAccounts.push(to)
    })
    .catch(error => {
      logger.error(`Error transfer [${idx1} -> ${idx2} (${formattedAmount} $APT)]: ${error}`)
    })
}


const main = async () => {

  const initialAmount = 500
  const accountsUpperLimit = 120
  const phase2epochs = 1000
  const dustAmount = parseUnits('0.001', 8)

  // Set up Alice account (Owner)
  const aliceAptos = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(process.env.OWNERPK_IMOLA)
  })
  const aliceAptosAddress = aliceAptos.accountAddress.toString()

  logger.info(`Alice address (Aptos): ${aliceAptosAddress}`)
  logger.info(`Alice address (Aptos) Balance: ${formatUnits(
    await rpcAptos.getAccountAPTAmount({ accountAddress: aliceAptosAddress }), 8
  )} $APT`)


  // Set up initial account (first distributor)
  const initialAccount = Account.generate()
  logger.debug(`Address [0]: ${explorerAddress(initialAccount)}`)

  await transferAndWait(
    aliceAptos, initialAccount,
    parseUnits(initialAmount.toString(), 8), 5_000, 'x', 0, 
  )

  logger.info(`Waiting for cooldown ...\n`)
  await new Promise(resolve => setTimeout(resolve, 5000))


  // Phase 1: Recursive transfer
  let accounts = [initialAccount]

  for (let layer = 0; ; layer++) {
    logger.warn(`Layer ${layer + 1} started, total ${accounts.length} accounts.`)
    let newAccounts = []
    let transactions = []

    for (let i = 0; i < accounts.length; i++) {
      let someone = Account.generate()
      logger.debug(`Address [${i + accounts.length}]: ${explorerAddress(someone)}`)
      let sender = accounts[i]
      let amount = parseInt(await rpcAptos.getAccountAPTAmount({ accountAddress: sender.accountAddress.toString() }) / 2)

      transactions.push(transferAndWait(
        sender, someone, amount, 5_000 + Math.random() * 1000, i, i + accounts.length, newAccounts,
      ))
    }

    await Promise.all(transactions)
    accounts.push(...newAccounts)

    logger.warn(`Layer ${layer + 1} done! Total ${accounts.length} accounts.`)

    if (accounts.length <= accountsUpperLimit) {
      logger.info(`Waiting for cooldown ...\n`)
      await new Promise(resolve => setTimeout(resolve, 5000))
    } else {
      break
    }
  }


  // Phase 2: Parallel transfer
  logger.warn(`\n\nPhase 2 started, total ${accounts.length} accounts.`)

  for (let epoch = 0; epoch < phase2epochs; epoch++) {
    logger.warn(`Epoch ${epoch + 1} started!`)
    const transactions = []
    for (let i = 0; i < accounts.length; i++) {
      let someone = Account.generate()
      transactions.push(transferAndWait(
        accounts[i], someone, dustAmount, 5_000 + Math.random() * 1000, i, '?'
      ))
    }
    await Promise.all(transactions)
    logger.warn(`Epoch ${epoch + 1} done!`)
    logger.info(`Waiting for cooldown ...\n`)
  }


}

main()
