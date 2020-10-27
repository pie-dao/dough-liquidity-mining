import { task, HardhatUserConfig } from "hardhat/config";
import "hardhat-typechain";

import "@nomiclabs/hardhat-waffle";

const config: HardhatUserConfig = {
  solidity: "0.5.12",
};


export default config;