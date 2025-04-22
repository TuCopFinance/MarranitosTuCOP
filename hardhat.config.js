require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("hardhat-gas-reporter");
require("solidity-coverage");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CELO_RPC_URL = process.env.CELO_RPC_URL;
const ALFAJORES_RPC_URL = process.env.ALFAJORES_RPC_URL;
const CELOSCAN_API_KEY = process.env.CELOSCAN_API_KEY;
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
      viaIR: false
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true
    },
    celo: {
      url: CELO_RPC_URL || "https://forno.celo.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 42220,
      gasPrice: 50000000000
    },
    alfajores: {
      url: ALFAJORES_RPC_URL || "https://alfajores-forno.celo-testnet.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 44787,
      gasPrice: 1000000000
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337
    }
  },
  etherscan: {
    apiKey: {
      celo: CELOSCAN_API_KEY,
      alfajores: CELOSCAN_API_KEY
    },
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io"
        }
      },
      {
        network: "alfajores",
        chainId: 44787,
        urls: {
          apiURL: "https://api-alfajores.celoscan.io/api",
          browserURL: "https://alfajores.celoscan.io"
        }
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY,
    token: "CELO",
    gasPrice: 100
  },
  mocha: {
    timeout: 100000
  }
};
