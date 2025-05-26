// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title cCOP Staking Contract
 * @dev Contrato de staking exclusivo para el token cCOP, con períodos de 30, 60 y 90 días.
 * Se incluyen mejoras para gestionar arrays largos (paginación), separar funciones críticas mediante
 * un mecanismo de gobernanza y documentar claramente el cálculo de recompensas y penalizaciones.
 * @author IntechChain
 */
contract cCOPStaking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Representa la información de un staking individual
    struct Stake {
        uint256 amount; // Cantidad de cCOP en staking
        uint256 startTime; // Timestamp de inicio del staking
        uint256 endTime; // Timestamp de finalización del staking
        uint256 duration; // Duración del staking en segundos
        bool claimed; // Indica si ya se han reclamado las recompensas
    }

    IERC20 public immutable cCOP; // Token cCOP
    address public developerWallet; // Wallet del desarrollador para recibir comisiones
    address public governance; // Dirección de gobernanza (por ejemplo, multisig)

    mapping(address => Stake[]) public stakes; // Registro de stakes por usuario

    uint256 private constant DAYS_30 = 30 days;
    uint256 private constant DAYS_60 = 60 days;
    uint256 private constant DAYS_90 = 90 days;

    // Variables para el pool de intereses
    uint256 public interestPool = 100000000 * 1e18; // $100,000,000 COP para pagos de intereses a usuarios
    
    // Límites de staking basados en el pool de intereses y cálculo de interés compuesto
    uint256 public constant MAX_STAKE_30 = 3200000000 * 1e18;    // $3,200,000,000 COP (40% del pool = 40M intereses)
    uint256 public constant MAX_STAKE_60 = 1157981803 * 1e18;    // $1,157,981,803 COP (35% del pool = 35M intereses)
    uint256 public constant MAX_STAKE_90 = 408443341 * 1e18;     // $408,443,341 COP (25% del pool = 25M intereses)

    // Comisión del desarrollador (5% sobre intereses generados)
    uint256 private constant DEVELOPER_FEE_PERCENTAGE = 5; // 5% de comisión para el desarrollador
    uint256 private constant PERCENTAGE_BASE = 100;

    // Distribución de intereses (base 100)
    uint256 private constant DISTRIBUTION_30_DAYS = 40; // 40%
    uint256 private constant DISTRIBUTION_60_DAYS = 35; // 35%
    uint256 private constant DISTRIBUTION_90_DAYS = 25; // 25%

    // Variables para tracking del total staked por período (histórico)
    uint256 public totalStaked30Days;
    uint256 public totalStaked60Days;
    uint256 public totalStaked90Days;

    // Variables para tracking del total activo por período
    uint256 public activeStaked30Days;
    uint256 public activeStaked60Days;
    uint256 public activeStaked90Days;

    // Variables para parámetros ajustables
    uint256 public stakingRate30Days = 125; // 1.25% nominal mensual
    uint256 public stakingRate60Days = 150; // 1.50% nominal mensual
    uint256 public stakingRate90Days = 200; // 2.00% nominal mensual

    // Lista blanca
    mapping(address => bool) public whitelisted;

    // Errores personalizados
    error InvalidDuration();
    error InvalidStakeIndex();
    error InvalidParameter();
    error StakeAlreadyClaimed();
    error StakeStillLocked();
    error ExceedsStakingLimit();
    error NotWhitelisted();
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 amount);

    // Eventos
    event Staked(address indexed user, uint256 amount, uint256 duration);
    event Withdrawn(address indexed user, uint256 amount, uint256 rewards);
    event DeveloperFeesPaid(address indexed developer, uint256 amount);
    event DeveloperWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event RatesUpdated(uint256 rate30, uint256 rate60, uint256 rate90);
    event WhitelistUpdated(address indexed user, bool status);

    constructor(address _cCOP, address _developerWallet) Ownable(msg.sender) {
        require(_cCOP != address(0), "Invalid cCOP address");
        require(_developerWallet != address(0), "Invalid developer wallet");

        cCOP = IERC20(_cCOP);
        developerWallet = _developerWallet;
        governance = msg.sender;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "Not authorized: only governance");
        _;
    }

    modifier onlyWhitelisted() {
        if (!whitelisted[msg.sender]) {
            revert NotWhitelisted();
        }
        _;
    }

    function isWhitelisted(address _user) public view returns (bool) {
        return whitelisted[_user];
    }

    function stake(uint256 _amount, uint256 _duration) external nonReentrant onlyWhitelisted {
        if (_amount == 0) revert("Amount must be greater than 0");
        if (_duration != DAYS_30 && _duration != DAYS_60 && _duration != DAYS_90) revert InvalidDuration();

        // Verificar límites según la duración y el total activo
        if (_duration == DAYS_30) {
            if (activeStaked30Days + _amount > MAX_STAKE_30) revert ExceedsStakingLimit();
            totalStaked30Days += _amount;
            activeStaked30Days += _amount;
        } else if (_duration == DAYS_60) {
            if (activeStaked60Days + _amount > MAX_STAKE_60) revert ExceedsStakingLimit();
            totalStaked60Days += _amount;
            activeStaked60Days += _amount;
        } else {
            if (activeStaked90Days + _amount > MAX_STAKE_90) revert ExceedsStakingLimit();
            totalStaked90Days += _amount;
            activeStaked90Days += _amount;
        }

        // Verificar balance y allowance
        uint256 balance = cCOP.balanceOf(msg.sender);
        uint256 allowance = cCOP.allowance(msg.sender, address(this));

        if (balance < _amount) revert ERC20InsufficientBalance(msg.sender, balance, _amount);
        if (allowance < _amount) revert ERC20InsufficientAllowance(address(this), allowance, _amount);

        // Transferir tokens al contrato
        cCOP.safeTransferFrom(msg.sender, address(this), _amount);

        // Crear un nuevo staking
        stakes[msg.sender].push(
            Stake({
                amount: _amount,
                startTime: block.timestamp,
                endTime: block.timestamp + _duration,
                duration: _duration,
                claimed: false
            })
        );

        emit Staked(msg.sender, _amount, _duration);
    }

    function withdraw(uint256 _stakeIndex) external nonReentrant {
        if (_stakeIndex >= stakes[msg.sender].length) revert InvalidStakeIndex();
        Stake storage userStake = stakes[msg.sender][_stakeIndex];
        if (userStake.claimed) revert StakeAlreadyClaimed();
        if (block.timestamp < userStake.endTime) revert StakeStillLocked();

        uint256 rewards = calculateRewards(userStake);
        uint256 developerFee = (rewards * DEVELOPER_FEE_PERCENTAGE) / PERCENTAGE_BASE;
        
        userStake.claimed = true;

        // Actualizar totales activos
        if (userStake.duration == DAYS_30) {
            activeStaked30Days -= userStake.amount;
        } else if (userStake.duration == DAYS_60) {
            activeStaked60Days -= userStake.amount;
        } else {
            activeStaked90Days -= userStake.amount;
        }

        cCOP.safeTransfer(msg.sender, userStake.amount + rewards);
        cCOP.safeTransfer(developerWallet, developerFee);

        emit Withdrawn(msg.sender, userStake.amount, rewards);
        emit DeveloperFeesPaid(developerWallet, developerFee);
    }

    function calculateRewards(Stake memory _stake) public view returns (uint256) {
        uint256 rate;
        uint256 distribution;
        
        if (_stake.duration == DAYS_30) {
            rate = stakingRate30Days;
            distribution = DISTRIBUTION_30_DAYS;
        } else if (_stake.duration == DAYS_60) {
            rate = stakingRate60Days;
            distribution = DISTRIBUTION_60_DAYS;
        } else if (_stake.duration == DAYS_90) {
            rate = stakingRate90Days;
            distribution = DISTRIBUTION_90_DAYS;
        } else {
            revert InvalidDuration();
        }

        uint256 months = _stake.duration / 30 days;
        uint256 base = 10000 + rate;
        uint256 compoundFactor = base;
        
        for (uint256 i = 1; i < months; i++) {
            compoundFactor = (compoundFactor * base) / 10000;
        }
        
        uint256 totalAmount = (_stake.amount * compoundFactor) / 10000;
        uint256 rewards = totalAmount - _stake.amount;
        uint256 poolShare = (interestPool * distribution) / 100;
        
        return rewards > poolShare ? poolShare : rewards;
    }

    function getTotalStakedByPeriod() external view returns (
        uint256 total30Days,
        uint256 total60Days,
        uint256 total90Days
    ) {
        return (totalStaked30Days, totalStaked60Days, totalStaked90Days);
    }

    function getActiveStakedByPeriod() external view returns (
        uint256 active30Days,
        uint256 active60Days,
        uint256 active90Days
    ) {
        return (activeStaked30Days, activeStaked60Days, activeStaked90Days);
    }

    function getAvailableStakingSpace() external view returns (
        uint256 available30Days,
        uint256 available60Days,
        uint256 available90Days
    ) {
        return (
            MAX_STAKE_30 - activeStaked30Days,
            MAX_STAKE_60 - activeStaked60Days,
            MAX_STAKE_90 - activeStaked90Days
        );
    }

    function updateDeveloperWallet(address _newWallet) external onlyGovernance {
        require(_newWallet != address(0), "Invalid wallet address");
        address oldWallet = developerWallet;
        developerWallet = _newWallet;
        emit DeveloperWalletUpdated(oldWallet, _newWallet);
    }

    function updateGovernance(address _newGovernance) external onlyGovernance {
        if (_newGovernance == address(0)) revert InvalidParameter();
        address oldGovernance = governance;
        governance = _newGovernance;
        emit GovernanceUpdated(oldGovernance, _newGovernance);
    }

    function updateStakingRates(
        uint256 _rate30,
        uint256 _rate60,
        uint256 _rate90
    ) external onlyGovernance nonReentrant {
        if (_rate30 == 0 || _rate60 == 0 || _rate90 == 0) revert InvalidParameter();
        stakingRate30Days = _rate30;
        stakingRate60Days = _rate60;
        stakingRate90Days = _rate90;
        emit RatesUpdated(_rate30, _rate60, _rate90);
    }

    function sweepUnclaimedTokens(uint256 _daysThreshold) external onlyGovernance nonReentrant {
        uint256 threshold = block.timestamp - (_daysThreshold * 1 days);
        uint256 totalUnclaimed = 0;
        
        for (uint256 i = 0; i < stakes[governance].length; i++) {
            Stake storage userStake = stakes[governance][i];
            if (!userStake.claimed && userStake.endTime < threshold) {
                totalUnclaimed += userStake.amount;
                userStake.claimed = true;
            }
        }
        
        if (totalUnclaimed > 0) {
            cCOP.safeTransfer(governance, totalUnclaimed);
        }
    }

    function addToWhitelist(address _user) external onlyGovernance {
        if (_user == address(0)) revert InvalidParameter();
        whitelisted[_user] = true;
        emit WhitelistUpdated(_user, true);
    }

    function removeFromWhitelist(address _user) external onlyGovernance {
        if (_user == address(0)) revert InvalidParameter();
        whitelisted[_user] = false;
        emit WhitelistUpdated(_user, false);
    }

    function addMultipleToWhitelist(address[] calldata _users) external onlyGovernance {
        for (uint256 i = 0; i < _users.length; i++) {
            if (_users[i] == address(0)) revert InvalidParameter();
            whitelisted[_users[i]] = true;
            emit WhitelistUpdated(_users[i], true);
        }
    }

    function getUserStakes(address _user) external view returns (Stake[] memory) {
        return stakes[_user];
    }

    function getUserStakesPaginated(
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (Stake[] memory) {
        Stake[] storage userStakes = stakes[_user];
        uint256 totalStakes = userStakes.length;
        
        if (_offset >= totalStakes) {
            return new Stake[](0);
        }
        
        uint256 end = _offset + _limit;
        if (end > totalStakes) {
            end = totalStakes;
        }
        
        uint256 resultLength = end - _offset;
        Stake[] memory result = new Stake[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = userStakes[_offset + i];
        }
        
        return result;
    }

    function getStakeInfo(
        address _user,
        uint256 _stakeIndex
    ) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 endTime,
        uint256 duration,
        bool claimed,
        uint256 rewards
    ) {
        require(_stakeIndex < stakes[_user].length, "Invalid stake index");
        Stake storage stake = stakes[_user][_stakeIndex];
        
        return (
            stake.amount,
            stake.startTime,
            stake.endTime,
            stake.duration,
            stake.claimed,
            calculateRewards(stake)
        );
    }
}
