require("dotenv").config();
import { HardhatUserConfig } from "hardhat/config";
import "hardhat-typechain";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";

import "solidity-coverage";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.5.12",
        settings: {
          optimizer: {
            enabled: false,
            runs: 200
          }
        }
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: false,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
    },
    frame: {
      url: "http://localhost:1248"
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  }
};




export default config;