import { useState, useEffect } from 'react';
import { Web3Auth } from "@web3auth/modal";
import { ethers } from 'ethers';
import { Container, Navbar, Button } from 'react-bootstrap';
import { web3authConfig } from './config/web3AuthConfig';
import { STAKING_ADDRESS, TOKEN_ADDRESS } from './contracts/addresses';
import StakingForm from './components/StakingForm';
import StakesList from './components/StakesList';

function App() {
    const [web3auth, setWeb3auth] = useState(null);
    const [provider, setProvider] = useState(null);
    const [account, setAccount] = useState(null);
    const [stakes, setStakes] = useState([]);
    const [totalStaked, setTotalStaked] = useState("0");
    const [pendingRewards, setPendingRewards] = useState("0");

    useEffect(() => {
        const init = async () => {
            try {
                const web3authInstance = new Web3Auth(web3authConfig);
                await web3authInstance.initModal();
                setWeb3auth(web3authInstance);
            } catch (error) {
                console.error("Error initializing Web3Auth:", error);
            }
        };
        init();
    }, []);

    const connect = async () => {
        try {
            const web3authProvider = await web3auth.connect();
            const ethersProvider = new ethers.providers.Web3Provider(web3authProvider);
            const signer = ethersProvider.getSigner();
            const address = await signer.getAddress();
            
            setProvider(ethersProvider);
            setAccount(address);
            
            await loadStakes(signer);
        } catch (error) {
            console.error("Error connecting:", error);
        }
    };

    const disconnect = async () => {
        if (web3auth) {
            await web3auth.logout();
            setProvider(null);
            setAccount(null);
            setStakes([]);
        }
    };

    const loadStakes = async (signer) => {
        try {
            const stakingContract = new ethers.Contract(STAKING_ADDRESS, StakingABI, signer);
            const userStakes = await stakingContract.getUserStakes(account);
            
            const stakesWithDetails = await Promise.all(userStakes.map(async (stake, index) => {
                const stakeRewards = await stakingContract.calculateRewards(index);
                return {
                    id: index,
                    amount: ethers.utils.formatEther(stake.amount),
                    startTime: new Date(stake.startTime * 1000),
                    duration: stake.duration,
                    rewards: ethers.utils.formatEther(stakeRewards)
                };
            }));
            
            setStakes(stakesWithDetails);
            updateTotals(stakesWithDetails);
        } catch (error) {
            console.error("Error loading stakes:", error);
        }
    };

    const updateTotals = (stakesArray) => {
        const total = stakesArray.reduce((acc, stake) => 
            acc.add(ethers.utils.parseEther(stake.amount)), 
            ethers.BigNumber.from(0)
        );
        const rewards = stakesArray.reduce((acc, stake) => 
            acc.add(ethers.utils.parseEther(stake.rewards)), 
            ethers.BigNumber.from(0)
        );
        
        setTotalStaked(ethers.utils.formatEther(total));
        setPendingRewards(ethers.utils.formatEther(rewards));
    };

    return (
        <Container className="py-4">
            <Navbar className="mb-4 bg-light rounded-3 shadow-sm p-3">
                <Container>
                    <Navbar.Brand>cCOP Staking</Navbar.Brand>
                    <div>
                        {!account ? (
                            <Button onClick={connect}>
                                <i className="bi bi-wallet2"></i> Conectar Wallet
                            </Button>
                        ) : (
                            <div className="d-flex align-items-center">
                                <span className="me-3">{account}</span>
                                <Button variant="outline-danger" onClick={disconnect}>
                                    Desconectar
                                </Button>
                            </div>
                        )}
                    </div>
                </Container>
            </Navbar>

            {account && (
                <>
                    <StakingForm 
                        onStake={handleStake} 
                        onApprove={handleApprove}
                    />
                    <StakesList 
                        stakes={stakes}
                        totalStaked={totalStaked}
                        pendingRewards={pendingRewards}
                        onUnstake={handleUnstake}
                        onClaim={handleClaim}
                    />
                </>
            )}
        </Container>
    );
}

export default App; 