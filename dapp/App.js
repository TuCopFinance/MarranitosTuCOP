import { Web3Auth } from "@web3auth/modal";
import { WEB3AUTH_CLIENT_ID, WEB3AUTH_NETWORK, chainConfig } from './config/web3AuthConfig.js';
import { ethers } from 'ethers';
import StakingABI from './abi/cCOPStaking.json';
import TokenABI from './abi/ERC20.json';
import './App.css';

const STAKING_ADDRESS = "0x33F9D44eef92314dAE345Aa64763B01cf484F3C6"; // Dirección del contrato de staking
const TOKEN_ADDRESS = "0x8A567e2aE79CA692Bd748aB832081C45de4041eA"; // Dirección del token cCOP

class StakingApp {
    constructor() {
        this.web3auth = null;
        this.provider = null;
        this.account = null;
        this.stakingContract = null;
        this.tokenContract = null;
        this.initializeElements();
        this.initializeWeb3Auth();
        this.addEventListeners();
    }

    initializeElements() {
        this.connectButton = document.getElementById('connect-button');
        this.disconnectButton = document.getElementById('disconnect-button');
        this.userInfo = document.getElementById('user-info');
        this.walletAddress = document.getElementById('wallet-address');
        this.userDetails = document.getElementById('user-details');
        this.stakingContainer = document.getElementById('staking-container');
        this.approveButton = document.getElementById('approve-button');
        this.stakeButton = document.getElementById('stake-button');
        this.stakesContainer = document.getElementById('stakes-container');
    }

    async initializeWeb3Auth() {
        try {
            this.web3auth = new Web3Auth({
                clientId: WEB3AUTH_CLIENT_ID,
                web3AuthNetwork: WEB3AUTH_NETWORK,
                chainConfig: chainConfig,
            });
            await this.web3auth.initModal();
        } catch (error) {
            console.error("Error initializing Web3Auth", error);
        }
    }

    addEventListeners() {
        this.connectButton.addEventListener('click', () => this.connect());
        this.disconnectButton.addEventListener('click', () => this.disconnect());
        this.approveButton.addEventListener('click', () => this.approveTokens());
        this.stakeButton.addEventListener('click', () => this.stake());
    }

    async connect() {
        try {
            const web3authProvider = await this.web3auth.connect();
            this.provider = new ethers.providers.Web3Provider(web3authProvider);
            const signer = this.provider.getSigner();
            this.account = await signer.getAddress();
            
            // Inicializar contratos
            this.stakingContract = new ethers.Contract(STAKING_ADDRESS, StakingABI, signer);
            this.tokenContract = new ethers.Contract(TOKEN_ADDRESS, TokenABI, signer);

            // Actualizar UI
            this.connectButton.style.display = 'none';
            this.userInfo.style.display = 'block';
            this.stakingContainer.style.display = 'block';
            this.walletAddress.textContent = `Wallet: ${this.account}`;

            // Cargar stakes
            await this.loadUserStakes();
        } catch (error) {
            console.error("Error connecting:", error);
        }
    }

    async disconnect() {
        if (this.web3auth) {
            await this.web3auth.logout();
            this.provider = null;
            this.account = null;
            this.stakingContract = null;
            this.tokenContract = null;

            // Actualizar UI
            this.connectButton.style.display = 'block';
            this.userInfo.style.display = 'none';
            this.stakingContainer.style.display = 'none';
            this.stakesContainer.innerHTML = '';
        }
    }

    async loadUserStakes() {
        try {
            const stakes = await this.stakingContract.getUserStakes(this.account);
            const stakesContainer = document.getElementById('stakes-container');
            const template = document.getElementById('stake-template');
            const noStakesMessage = document.getElementById('no-stakes-message');
            
            stakesContainer.innerHTML = '';
            
            if (stakes.length === 0) {
                noStakesMessage.style.display = 'block';
                return;
            }
            
            noStakesMessage.style.display = 'none';
            let totalStaked = ethers.BigNumber.from(0);
            let totalRewards = ethers.BigNumber.from(0);

            stakes.forEach(async (stake, index) => {
                const stakeElement = template.content.cloneNode(true);
                
                // Actualizar los campos del template
                stakeElement.querySelector('.stake-id').textContent = index + 1;
                stakeElement.querySelector('.stake-amount').textContent = 
                    `${ethers.utils.formatEther(stake.amount)} cCOP`;
                stakeElement.querySelector('.stake-start').textContent = 
                    new Date(stake.startTime * 1000).toLocaleDateString();
                stakeElement.querySelector('.stake-duration').textContent = 
                    `${stake.duration} días`;
                
                const endDate = new Date(stake.startTime * 1000 + (stake.duration * 24 * 60 * 60 * 1000));
                stakeElement.querySelector('.stake-end').textContent = 
                    endDate.toLocaleDateString();

                // Calcular y mostrar APY
                const apy = await this.stakingContract.getAPY(stake.duration);
                stakeElement.querySelector('.stake-apy').textContent = 
                    `${ethers.utils.formatUnits(apy, 2)}%`;

                // Calcular recompensas pendientes
                const rewards = await this.stakingContract.calculateRewards(index);
                stakeElement.querySelector('.stake-rewards').textContent = 
                    `${ethers.utils.formatEther(rewards)} cCOP`;

                // Actualizar totales
                totalStaked = totalStaked.add(stake.amount);
                totalRewards = totalRewards.add(rewards);

                // Configurar botones
                const unstakeButton = stakeElement.querySelector('.unstake-button');
                unstakeButton.onclick = () => this.unstake(index);

                const claimButton = stakeElement.querySelector('.claim-rewards-button');
                claimButton.onclick = () => this.claimRewards(index);

                // Determinar y mostrar estado
                const now = Math.floor(Date.now() / 1000);
                const isCompleted = now > stake.startTime + (stake.duration * 24 * 60 * 60);
                const statusElement = stakeElement.querySelector('.stake-status');
                statusElement.textContent = isCompleted ? 'Completado' : 'Activo';
                statusElement.className = `stake-status ${isCompleted ? 'completed' : 'active'}`;

                stakesContainer.appendChild(stakeElement);
            });

            // Actualizar resumen
            document.getElementById('total-staked').textContent = 
                `${ethers.utils.formatEther(totalStaked)} cCOP`;
            document.getElementById('pending-rewards').textContent = 
                `${ethers.utils.formatEther(totalRewards)} cCOP`;

        } catch (error) {
            console.error("Error loading stakes:", error);
        }
    }

    async approveTokens() {
        try {
            const amount = document.getElementById('amount').value;
            const amountWei = ethers.utils.parseEther(amount);
            const tx = await this.tokenContract.approve(STAKING_ADDRESS, amountWei);
            await tx.wait();
            alert("Tokens aprobados correctamente");
        } catch (error) {
            console.error("Error approving tokens:", error);
        }
    }

    async stake() {
        try {
            const amount = document.getElementById('amount').value;
            const duration = document.getElementById('duration').value;
            const amountWei = ethers.utils.parseEther(amount);
            
            const tx = await this.stakingContract.stake(amountWei, duration);
            await tx.wait();
            alert("Stake realizado correctamente");
            await this.loadUserStakes();
        } catch (error) {
            console.error("Error staking:", error);
        }
    }

    async unstake(stakeIndex) {
        try {
            const tx = await this.stakingContract.unstake(stakeIndex);
            await tx.wait();
            alert("Tokens retirados correctamente");
            await this.loadUserStakes();
        } catch (error) {
            console.error("Error unstaking:", error);
        }
    }

    async claimRewards(stakeIndex) {
        // Implementa la lógica para reclamar recompensas
        console.log(`Reclamar recompensas del stake ${stakeIndex}`);
    }
}

// Inicializar la aplicación
const app = new StakingApp();
window.app = app; // Para acceder a la instancia desde el HTML 