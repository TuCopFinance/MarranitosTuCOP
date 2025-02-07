require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("hardhat-celo");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CELO_RPC_URL = process.env.CELO_RPC_URL;
const ALFAJORES_RPC_URL = process.env.ALFAJORES_RPC_URL;
const CELOSCAN_API_KEY = process.env.CELOSCAN_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {},
    celo: {
      url: CELO_RPC_URL || "https://forno.celo.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 42220,
    },
    alfajores: {
      url: ALFAJORES_RPC_URL || "https://alfajores-forno.celo-testnet.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 44787,
    }
  },
  verify: {
    etherscan: {
      apiKey: CELOSCAN_API_KEY
    }
  }
};
