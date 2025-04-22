const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DispersionContract", function () {
  let dispersionContract;
  let token;
  let governance;
  let dispersion;
  let owner;
  let user1;
  let user2;
  
  const fixedAmount = ethers.parseEther("1000");
  const initialSupply = ethers.parseEther("1000000");

  beforeEach(async function () {
    // Obtener las cuentas de prueba
    [owner, governance, dispersion, user1, user2] = await ethers.getSigners();
    
    // Desplegar el token cCOP (un ERC20 simple para pruebas)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("cCOP Token", "cCOP", initialSupply);
    
    // Desplegar el contrato de dispersión
    const DispersionContract = await ethers.getContractFactory("DispersionContract");
    dispersionContract = await DispersionContract.deploy(
      await token.getAddress(),
      governance.address,
      dispersion.address,
      fixedAmount
    );
    
    // Transferir tokens al contrato de dispersión
    await token.transfer(await dispersionContract.getAddress(), fixedAmount * BigInt(2));
  });

  describe("Despliegue", function () {
    it("Debe establecer el token correctamente", async function () {
      expect(await dispersionContract.token()).to.equal(await token.getAddress());
    });

    it("Debe establecer la gobernanza correctamente", async function () {
      expect(await dispersionContract.governance()).to.equal(governance.address);
    });

    it("Debe establecer la dirección de dispersión correctamente", async function () {
      expect(await dispersionContract.dispersion()).to.equal(dispersion.address);
    });

    it("Debe establecer la cantidad fija correctamente", async function () {
      expect(await dispersionContract.fixedAmount()).to.equal(fixedAmount);
    });

    it("Debe revertir si el token es la dirección cero", async function () {
      const DispersionContract = await ethers.getContractFactory("DispersionContract");
      await expect(DispersionContract.deploy(
        ethers.ZeroAddress,
        governance.address,
        dispersion.address,
        fixedAmount
      )).to.be.revertedWith("Invalid token address");
    });

    it("Debe revertir si la gobernanza es la dirección cero", async function () {
      const DispersionContract = await ethers.getContractFactory("DispersionContract");
      await expect(DispersionContract.deploy(
        await token.getAddress(),
        ethers.ZeroAddress,
        dispersion.address,
        fixedAmount
      )).to.be.revertedWith("Invalid governance address");
    });

    it("Debe revertir si la cantidad fija es cero", async function () {
      const DispersionContract = await ethers.getContractFactory("DispersionContract");
      await expect(DispersionContract.deploy(
        await token.getAddress(),
        governance.address,
        dispersion.address,
        0
      )).to.be.revertedWith("Invalid fixed amount");
    });
  });

  describe("Dispersión de tokens", function () {
    it("Debe permitir a la dirección de dispersión dispersar tokens", async function () {
      const balanceBefore = await token.balanceOf(user1.address);
      
      await dispersionContract.connect(dispersion).disperseTokens(user1.address);
      
      const balanceAfter = await token.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(fixedAmount);
    });

    it("Debe emitir evento TokensDispersed", async function () {
      await expect(dispersionContract.connect(dispersion).disperseTokens(user1.address))
        .to.emit(dispersionContract, "TokensDispersed")
        .withArgs(user1.address, fixedAmount);
    });

    it("Debe revertir si el balance es insuficiente", async function () {
      // Agotar el balance del contrato
      await dispersionContract.connect(dispersion).disperseTokens(user1.address);
      await dispersionContract.connect(dispersion).disperseTokens(user1.address);
      
      await expect(dispersionContract.connect(dispersion).disperseTokens(user1.address))
        .to.be.revertedWith("Insufficient contract balance");
    });

    it("Debe revertir si el llamante no es la dirección de dispersión", async function () {
      await expect(dispersionContract.connect(user1).disperseTokens(user2.address))
        .to.be.revertedWith("Not authorized: only dispersion");
    });
  });

  describe("Retiro de otros tokens", function () {
    it("Debe permitir a la gobernanza retirar otros tokens", async function () {
      // Crear un token diferente
      const OtherToken = await ethers.getContractFactory("MockERC20");
      const otherToken = await OtherToken.deploy("Other Token", "OTK", initialSupply);
      
      // Transferir tokens al contrato de dispersión
      await otherToken.transfer(await dispersionContract.getAddress(), fixedAmount);
      
      // Retirar los tokens
      await dispersionContract.connect(governance).withdrawOtherTokens(
        await otherToken.getAddress(),
        fixedAmount
      );
      
      expect(await otherToken.balanceOf(owner.address)).to.equal(initialSupply);
    });

    it("Debe revertir al intentar retirar el token principal", async function () {
      await expect(dispersionContract.connect(governance).withdrawOtherTokens(
        await token.getAddress(),
        fixedAmount
      )).to.be.revertedWith("Cannot withdraw main token");
    });

    it("Debe revertir si el llamante no es la gobernanza", async function () {
      const OtherToken = await ethers.getContractFactory("MockERC20");
      const otherToken = await OtherToken.deploy("Other Token", "OTK", initialSupply);
      
      await expect(dispersionContract.connect(user1).withdrawOtherTokens(
        await otherToken.getAddress(),
        fixedAmount
      )).to.be.revertedWith("Not authorized: only governance");
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
      const newAmount = ethers.parseEther("2000");
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
      await expect(dispersionContract.connect(user1).updateFixedAmount(ethers.parseEther("2000")))
        .to.be.revertedWith("Not authorized: only governance");
    });
  });
}); 