const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("cCOPStaking", function () {
  let cCOPStaking, staking;
  let MockERC20, cCOPToken;
  let owner, developer, user1, user2;
  const DAYS_30 = 30 * 24 * 60 * 60;
  const DAYS_60 = 60 * 24 * 60 * 60;
  const DAYS_90 = 90 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, developer, user1, user2] = await ethers.getSigners();

    // Desplegar token mock cCOP
    MockERC20 = await ethers.getContractFactory("MockERC20");
    cCOPToken = await MockERC20.deploy("cCOP Token", "cCOP", 18);

    // Desplegar contrato de staking
    cCOPStaking = await ethers.getContractFactory("cCOPStaking");
    staking = await cCOPStaking.deploy(
      await cCOPToken.getAddress(),
      developer.address
    );

    // Mint tokens para testing
    const amount = ethers.parseEther("1000000");
    await cCOPToken.mint(user1.address, amount);
    await cCOPToken.mint(user2.address, amount);
    
    // Mintear tokens adicionales al contrato de staking para rewards
    await cCOPToken.mint(await staking.getAddress(), ethers.parseEther("100000")); // Para cubrir los rewards

    // Aprobar tokens para el contrato de staking
    await cCOPToken.connect(user1).approve(await staking.getAddress(), amount);
    await cCOPToken.connect(user2).approve(await staking.getAddress(), amount);
  });

  describe("Deployment", function () {
    it("Should set the correct cCOP token address", async function () {
      expect(await staking.cCOP()).to.equal(await cCOPToken.getAddress());
    });

    it("Should set the correct developer wallet", async function () {
      expect(await staking.developerWallet()).to.equal(developer.address);
    });

    it("Should revert if zero address is provided for cCOP", async function () {
      const cCOPStaking = await ethers.getContractFactory("cCOPStaking");
      await expect(cCOPStaking.deploy(
        ethers.ZeroAddress,
        developer.address
      )).to.be.revertedWith("Invalid cCOP address");
    });

    it("Should revert if zero address is provided for developer wallet", async function () {
      const cCOPStaking = await ethers.getContractFactory("cCOPStaking");
      await expect(cCOPStaking.deploy(
        await cCOPToken.getAddress(),
        ethers.ZeroAddress
      )).to.be.revertedWith("Invalid developer wallet");
    });
  });

  describe("Staking Functionality", function () {
    describe("Stake", function () {
      it("Should allow staking for 30 days", async function () {
        const amount = ethers.parseEther("1000");
        await expect(staking.connect(user1).stake(amount, DAYS_30))
          .to.emit(staking, "Staked")
          .withArgs(user1.address, amount, DAYS_30);
      });

      it("Should allow staking for 60 days", async function () {
        const amount = ethers.parseEther("1000");
        await expect(staking.connect(user1).stake(amount, DAYS_60))
          .to.emit(staking, "Staked")
          .withArgs(user1.address, amount, DAYS_60);
      });

      it("Should allow staking for 90 days", async function () {
        const amount = ethers.parseEther("1000");
        await expect(staking.connect(user1).stake(amount, DAYS_90))
          .to.emit(staking, "Staked")
          .withArgs(user1.address, amount, DAYS_90);
      });

      it("Should revert with invalid staking period", async function () {
        const amount = ethers.parseEther("1000");
        await expect(staking.connect(user1).stake(amount, 15 * 24 * 60 * 60))
          .to.be.revertedWithCustomError(staking, "InvalidStakingPeriod");
      });

      it("Should revert when amount exceeds limit", async function () {
        const maxLimit = await staking.MAX_STAKE_30();
        const exceedingAmount = maxLimit + 1n;
        await expect(staking.connect(user1).stake(exceedingAmount, DAYS_30))
          .to.be.revertedWithCustomError(staking, "ExceedsStakingLimit");
      });
    });

    describe("Withdraw", function () {
      beforeEach(async function () {
        this.stakeAmount = ethers.parseEther("1000");
        await staking.connect(user1).stake(this.stakeAmount, DAYS_30);
      });

      it("Should not allow withdrawal before lock period", async function () {
        await expect(staking.connect(user1).withdraw(0))
          .to.be.revertedWith("Stake still locked");
      });

      it("Should allow withdrawal after lock period", async function () {
        await time.increase(DAYS_30);
        await expect(staking.connect(user1).withdraw(0))
          .to.emit(staking, "Withdrawn");
      });

      it("Should calculate and transfer correct rewards", async function () {
        await time.increase(DAYS_30);
        const expectedReward = (this.stakeAmount * 125n) / 10000n; // 1.25%
        const developerFee = (expectedReward * 5n) / 100n; // 5%
        const userReward = expectedReward - developerFee;

        await expect(staking.connect(user1).withdraw(0))
          .to.emit(staking, "Withdrawn")
          .withArgs(user1.address, this.stakeAmount, userReward)
          .and.to.emit(staking, "DeveloperFeesPaid")
          .withArgs(developer.address, developerFee);
      });

      it("Should not allow double withdrawal", async function () {
        await time.increase(DAYS_30);
        await staking.connect(user1).withdraw(0);
        await expect(staking.connect(user1).withdraw(0))
          .to.be.revertedWith("Already claimed");
      });
    });

    describe("Early Withdrawal", function () {
      beforeEach(async function () {
        this.stakeAmount = ethers.parseEther("1000");
        // Guardar balance inicial
        this.initialBalance = await cCOPToken.balanceOf(user1.address);
        await staking.connect(user1).stake(this.stakeAmount, DAYS_30);
      });

      it("Debería aplicar penalización del 20% por retiro anticipado", async function () {
        // Avanzar 15 días (mitad del período)
        await time.increase(15 * 24 * 60 * 60);

        const penalizacion = (this.stakeAmount * 20n) / 100n; // 20% de penalización
        const montoEsperado = this.stakeAmount - penalizacion;

        await expect(staking.connect(user1).earlyWithdraw(0))
          .to.emit(staking, "EarlyWithdrawn")
          .withArgs(user1.address, this.stakeAmount, penalizacion, montoEsperado);

        // Verificar que el usuario recibió el monto correcto
        const balanceFinal = await cCOPToken.balanceOf(user1.address);
        // El balance final debe ser: balance inicial - monto stakeado + monto retornado
        const balanceEsperado = this.initialBalance - this.stakeAmount + montoEsperado;
        expect(balanceFinal).to.equal(balanceEsperado);
      });

      it("No debería permitir retiro anticipado después del período de bloqueo", async function () {
        // Avanzar más allá del período de bloqueo
        await time.increase(DAYS_30 + 1);

        await expect(staking.connect(user1).earlyWithdraw(0))
          .to.be.revertedWith("Stake period ended");
      });

      it("No debería permitir retiro anticipado si ya fue retirado", async function () {
        await time.increase(15 * 24 * 60 * 60);
        await staking.connect(user1).earlyWithdraw(0);

        await expect(staking.connect(user1).earlyWithdraw(0))
          .to.be.revertedWith("Already claimed");
      });
    });

    describe("Rewards Calculation", function () {
      it("Debería calcular correctamente las recompensas después del período completo", async function () {
        const amount = ethers.parseEther("1000");
        await staking.connect(user1).stake(amount, DAYS_30);
        
        await time.increase(DAYS_30);
        
        const expectedReward = (amount * 125n) / 10000n; // 1.25%
        const developerFee = (expectedReward * 5n) / 100n;
        const userReward = expectedReward - developerFee;

        await expect(staking.connect(user1).withdraw(0))
          .to.emit(staking, "Withdrawn")
          .withArgs(user1.address, amount, userReward);
      });
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      this.stakeAmount = ethers.parseEther("1000");
      await staking.connect(user1).stake(this.stakeAmount, DAYS_30);
      await staking.connect(user1).stake(this.stakeAmount, DAYS_60);
    });

    it("Should return correct user stakes", async function () {
      const stakes = await staking.getUserStakes(user1.address);
      expect(stakes.length).to.equal(2);
      expect(stakes[0].amount).to.equal(this.stakeAmount);
      expect(stakes[0].duration).to.equal(DAYS_30);
      expect(stakes[1].duration).to.equal(DAYS_60);
    });

    it("Should return correct number of active stakes", async function () {
      expect(await staking.getTotalActiveStakesPaginated(user1.address, 0, 10)).to.equal(2);
      
      // Avanzar tiempo y retirar un stake
      await time.increase(DAYS_30);
      await staking.connect(user1).withdraw(0);
      
      expect(await staking.getTotalActiveStakesPaginated(user1.address, 0, 10)).to.equal(1);
    });

    it("Should calculate correct rewards for different periods", async function () {
      const stake30 = {
        amount: ethers.parseEther("1000"),
        startTime: await time.latest(),
        endTime: (await time.latest()) + DAYS_30,
        duration: DAYS_30,
        claimed: false
      };

      const stake60 = {
        ...stake30,
        duration: DAYS_60,
        endTime: (await time.latest()) + DAYS_60
      };

      const stake90 = {
        ...stake30,
        duration: DAYS_90,
        endTime: (await time.latest()) + DAYS_90
      };

      const reward30 = await staking.calculateRewards(stake30);
      const reward60 = await staking.calculateRewards(stake60);
      const reward90 = await staking.calculateRewards(stake90);

      expect(reward30).to.equal((stake30.amount * 125n) / 10000n); // 1.25%
      expect(reward60).to.equal((stake60.amount * 150n) / 10000n); // 1.50%
      expect(reward90).to.equal((stake90.amount * 200n) / 10000n); // 2.00%
    });
  });

  describe("Admin Functions", function () {
    it("Should allow governance to update developer wallet", async function () {
      await expect(staking.connect(owner).updateDeveloperWallet(user2.address))
        .to.emit(staking, "DeveloperWalletUpdated")
        .withArgs(developer.address, user2.address);
      
      expect(await staking.developerWallet()).to.equal(user2.address);
    });

    it("Should not allow non-governance to update developer wallet", async function () {
      await expect(staking.connect(user1).updateDeveloperWallet(user2.address))
        .to.be.revertedWith("Not authorized: only governance");
    });

    it("Should not allow updating developer wallet to zero address", async function () {
      await expect(staking.connect(owner).updateDeveloperWallet(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid wallet address");
    });
  });

  describe("Governance", function () {
    it("Should set initial governance to deployer", async function () {
      expect(await staking.governance()).to.equal(owner.address);
    });

    it("Should allow owner to update governance", async function () {
      await expect(staking.connect(owner).updateGovernance(user2.address))
        .to.emit(staking, "GovernanceUpdated")
        .withArgs(owner.address, user2.address);
      expect(await staking.governance()).to.equal(user2.address);
    });

    it("Should not allow non-owner to update governance", async function () {
      await expect(staking.connect(user1).updateGovernance(user2.address))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });
  });

  describe("Paginación", function () {
    beforeEach(async function () {
      // Crear múltiples stakes para probar paginación
      for (let i = 0; i < 5; i++) {
        await staking.connect(user1).stake(ethers.parseEther("1000"), DAYS_30);
      }
    });

    it("Should return correct paginated stakes", async function () {
      const stakes = await staking.getUserStakesPaginated(user1.address, 1, 2);
      expect(stakes.length).to.equal(2);
    });

    it("Should return correct number of active stakes with pagination", async function () {
      const activeStakes = await staking.getTotalActiveStakesPaginated(user1.address, 0, 3);
      expect(activeStakes).to.equal(3);
    });

    it("Should handle pagination bounds correctly", async function () {
      const emptyStakes = await staking.getUserStakesPaginated(user1.address, 10, 2);
      expect(emptyStakes.length).to.equal(0);
    });
  });

  describe("Developer Wallet Management", function () {
    it("Should only allow governance to update developer wallet", async function () {
      await expect(staking.connect(user1).updateDeveloperWallet(user2.address))
        .to.be.revertedWith("Not authorized: only governance");
      
      await expect(staking.connect(owner).updateDeveloperWallet(user2.address))
        .to.emit(staking, "DeveloperWalletUpdated")
        .withArgs(developer.address, user2.address);
    });
  });

  describe("Early Withdrawal with Developer Fee", function () {
    beforeEach(async function () {
      this.stakeAmount = ethers.parseEther("1000");
      this.initialBalance = await cCOPToken.balanceOf(user1.address);
      await staking.connect(user1).stake(this.stakeAmount, DAYS_30);
    });

    it("Should transfer correct amounts during early withdrawal", async function () {
      await time.increase(15 * 24 * 60 * 60);
      const penalty = (this.stakeAmount * 20n) / 100n; // 20% de penalización
      const amountToReturn = this.stakeAmount - penalty;

      // Verificar solo los cambios de balance
      await expect(staking.connect(user1).earlyWithdraw(0))
        .to.changeTokenBalances(
          cCOPToken,
          [user1, developer, staking],
          [amountToReturn, penalty, -this.stakeAmount]
        );
    });

    it("Should emit correct event during early withdrawal", async function () {
      await time.increase(15 * 24 * 60 * 60);
      const penalty = (this.stakeAmount * 20n) / 100n; // 20% de penalización
      const amountToReturn = this.stakeAmount - penalty;

      // Verificar solo el evento
      await expect(staking.connect(user1).earlyWithdraw(0))
        .to.emit(staking, "EarlyWithdrawn")
        .withArgs(user1.address, this.stakeAmount, penalty, amountToReturn);
    });
  });
});
