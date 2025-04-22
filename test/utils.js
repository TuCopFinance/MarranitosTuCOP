const { ethers } = require("hardhat");

// Avanzar el tiempo de la blockchain
async function advanceTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
}

// Avanzar bloques en la blockchain
async function advanceBlocks(blocks) {
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine");
  }
}

module.exports = {
  advanceTime,
  advanceBlocks
}; 