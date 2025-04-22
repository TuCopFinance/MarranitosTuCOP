const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DispersionContract", function () {
  let dispersionContract;
  let governance;
  let dispersion;
  let user1;
  let user2;
  
  const fixedAmount = ethers.parseEther("1"); // 1 ETH
  const testAmount = ethers.parseEther("2"); // 2 ETH para pruebas

  beforeEach(async function () {
    // Obtener las cuentas de prueba
    [governance, dispersion, user1, user2] = await ethers.getSigners();
    
    // Desplegar el contrato de dispersión
    const DispersionContract = await ethers.getContractFactory("DispersionContract");
    dispersionContract = await DispersionContract.deploy(
      governance.address,
      dispersion.address,
      fixedAmount
    );
    
    // Enviar ETH al contrato
    await governance.sendTransaction({
      to: await dispersionContract.getAddress(),
      value: testAmount
    });
  });

  describe("Despliegue", function () {
    it("Debe establecer la gobernanza correctamente", async function () {
      expect(await dispersionContract.governance()).to.equal(governance.address);
    });

    it("Debe establecer la dirección de dispersión correctamente", async function () {
      expect(await dispersionContract.dispersion()).to.equal(dispersion.address);
    });

    it("Debe establecer la cantidad fija correctamente", async function () {
      expect(await dispersionContract.fixedAmount()).to.equal(fixedAmount);
    });

    it("Debe revertir si la gobernanza es la dirección cero", async function () {
      const DispersionContract = await ethers.getContractFactory("DispersionContract");
      await expect(DispersionContract.deploy(
        ethers.ZeroAddress,
        dispersion.address,
        fixedAmount
      )).to.be.revertedWith("Invalid governance address");
    });

    it("Debe revertir si la cantidad fija es cero", async function () {
      const DispersionContract = await ethers.getContractFactory("DispersionContract");
      await expect(DispersionContract.deploy(
        governance.address,
        dispersion.address,
        0
      )).to.be.revertedWith("Invalid fixed amount");
    });
  });

  describe("Dispersión de ETH", function () {
    it("Debe permitir a la dirección de dispersión dispersar ETH", async function () {
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      await dispersionContract.connect(dispersion).disperseEth(user1.address);
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(fixedAmount);
    });

    it("Debe emitir evento EthDispersed", async function () {
      await expect(dispersionContract.connect(dispersion).disperseEth(user1.address))
        .to.emit(dispersionContract, "EthDispersed")
        .withArgs(user1.address, fixedAmount);
    });

    it("Debe revertir si el balance es insuficiente", async function () {
      // Agotar el balance del contrato
      await dispersionContract.connect(dispersion).disperseEth(user1.address);
      await dispersionContract.connect(dispersion).disperseEth(user1.address);
      
      await expect(dispersionContract.connect(dispersion).disperseEth(user1.address))
        .to.be.revertedWith("Insufficient contract balance");
    });

    it("Debe revertir si el llamante no es la dirección de dispersión", async function () {
      await expect(dispersionContract.connect(user1).disperseEth(user2.address))
        .to.be.revertedWith("Not authorized: only dispersion");
    });
  });

  describe("Transferencia de gobernanza", function () {
    it("Debe permitir al governance transferir su rol", async function () {
      await expect(dispersionContract.connect(governance).transferGovernance(user1.address))
        .to.emit(dispersionContract, "GovernanceUpdated")
        .withArgs(governance.address, user1.address);
      
      expect(await dispersionContract.governance()).to.equal(user1.address);
    });

    it("Debe revertir si la nueva dirección es cero", async function () {
      await expect(dispersionContract.connect(governance).transferGovernance(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid governance address");
    });

    it("Debe revertir si la nueva dirección es la misma que la actual", async function () {
      await expect(dispersionContract.connect(governance).transferGovernance(governance.address))
        .to.be.revertedWith("New governance same as current");
    });

    it("Debe revertir si el llamante no es governance", async function () {
      await expect(dispersionContract.connect(user1).transferGovernance(user2.address))
        .to.be.revertedWith("Not authorized: only governance");
    });
  });

  describe("Actualización de cantidad fija", function () {
    it("Debe permitir al governance actualizar la cantidad fija", async function () {
      const newAmount = ethers.parseEther("2");
      await expect(dispersionContract.connect(governance).updateFixedAmount(newAmount))
        .to.emit(dispersionContract, "FixedAmountUpdated")
        .withArgs(fixedAmount, newAmount);
      
      expect(await dispersionContract.fixedAmount()).to.equal(newAmount);
    });

    it("Debe revertir si la nueva cantidad es cero", async function () {
      await expect(dispersionContract.connect(governance).updateFixedAmount(0))
        .to.be.revertedWith("Invalid fixed amount");
    });

    it("Debe revertir si el llamante no es governance", async function () {
      await expect(dispersionContract.connect(user1).updateFixedAmount(ethers.parseEther("2")))
        .to.be.revertedWith("Not authorized: only governance");
    });
  });
}); 