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

    uint256 private constant DEVELOPER_FEE_PERCENTAGE = 5; // 5% de comisión para el desarrollador
    uint256 private constant PERCENTAGE_BASE = 100;

    // Límites de staking
    uint256 public constant MAX_STAKE_30 = 3160493827 * 1e18; // $3,160,493,827 COP
    uint256 public constant MAX_STAKE_60 = 2264877414 * 1e18; // $2,264,877,414 COP
    uint256 public constant MAX_STAKE_90 = 1177902918 * 1e18; // $1,177,902,918 COP

    // Tasas de interés (base 10000)
    uint256 private constant RATE_BASE = 10000;

    // Distribución de intereses (base 100)
    uint256 private constant DISTRIBUTION_30_DAYS = 40; // 40%
    uint256 private constant DISTRIBUTION_60_DAYS = 35; // 35%
    uint256 private constant DISTRIBUTION_90_DAYS = 25; // 25%

    // Errores personalizados
    error InvalidDuration();
    error InvalidStakeIndex();
    error InvalidParameter();
    error StakeAlreadyClaimed();
    error StakeStillLocked();
    error StakePeriodEnded();
    error InvalidStakingPeriod();
    error ExceedsStakingLimit();
    error NotWhitelisted();
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 amount);

    // Nuevas variables para parámetros ajustables
    uint256 public stakingRate30Days = 125; // 1.25% nominal mensual
    uint256 public stakingRate60Days = 150; // 1.50% nominal mensual
    uint256 public stakingRate90Days = 200; // 2.00% nominal mensual

    // Variables para el pool de intereses
    uint256 public interestPool = 100000000 * 1e18; // $100,000,000 COP para pagos de intereses
    
    // Agregar nuevo mapping para la lista blanca
    mapping(address => bool) public whitelisted;
    
    // Nuevo evento
    event WhitelistUpdated(address indexed user, bool status);

    // Eventos
    event Staked(address indexed user, uint256 amount, uint256 duration);
    event Withdrawn(address indexed user, uint256 amount, uint256 rewards);
    event DeveloperFeesPaid(address indexed developer, uint256 amount);
    event DeveloperWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet
    );
    event GovernanceUpdated(
        address indexed oldGovernance,
        address indexed newGovernance
    );
    event RatesUpdated(uint256 rate30, uint256 rate60, uint256 rate90);

    /**
     * @dev Constructor del contrato.
     * @param _cCOP Dirección del token cCOP.
     * @param _developerWallet Dirección de la wallet del desarrollador.
     */
    constructor(address _cCOP, address _developerWallet) Ownable(msg.sender) {
        require(_cCOP != address(0), "Invalid cCOP address");
        require(_developerWallet != address(0), "Invalid developer wallet");

        cCOP = IERC20(_cCOP);
        developerWallet = _developerWallet;
        governance = msg.sender;
    }

    /**
     * @notice Modificador para funciones que sólo pueden ser ejecutadas por la gobernanza.
     */
    modifier onlyGovernance() {
        require(msg.sender == governance, "Not authorized: only governance");
        _;
    }

    /**
     * @notice Modificador para verificar si una dirección está en la lista blanca
     */
    modifier onlyWhitelisted() {
        if (!whitelisted[msg.sender]) {
            revert NotWhitelisted();
        }
        _;
    }

    /**
     * @notice Verifica si una dirección está en la lista blanca
     * @param _user Dirección a verificar
     * @return bool Verdadero si la dirección está en la lista blanca
     */
    function isWhitelisted(address _user) public view returns (bool) {
        return whitelisted[_user];
    }

    /**
     * @notice Permite a los usuarios hacer staking de cCOP.
     * @param _amount Cantidad de cCOP a hacer stake.
     * @param _duration Duración del staking (30, 60 o 90 días).
     */
    function stake(uint256 _amount, uint256 _duration) external nonReentrant {
        // Verificar lista blanca primero
        if (!whitelisted[msg.sender]) {
            revert NotWhitelisted();
        }

        // Verificar monto
        if (_amount == 0) {
            revert("Amount must be greater than 0");
        }

        // Verificar duración
        if (_duration != DAYS_30 && _duration != DAYS_60 && _duration != DAYS_90) {
            revert InvalidStakingPeriod();
        }

        // Verificar límites según la duración
        if (_amount > getMaxStakeAmount(_duration)) {
            revert ExceedsStakingLimit();
        }

        // Verificar balance y allowance antes de la transferencia
        uint256 balance = cCOP.balanceOf(msg.sender);
        uint256 allowance = cCOP.allowance(msg.sender, address(this));

        if (balance < _amount) {
            revert ERC20InsufficientBalance(msg.sender, balance, _amount);
        }

        if (allowance < _amount) {
            revert ERC20InsufficientAllowance(address(this), allowance, _amount);
        }

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

    /**
     * @notice Permite a los usuarios retirar su staking junto con las recompensas.
     * @param _stakeIndex Índice del staking en el array del usuario.
     */
    function withdraw(uint256 _stakeIndex) external nonReentrant {
        if (_stakeIndex >= stakes[msg.sender].length)
            revert InvalidStakeIndex();
        Stake storage userStake = stakes[msg.sender][_stakeIndex];
        if (userStake.claimed) revert StakeAlreadyClaimed();
        if (block.timestamp < userStake.endTime) revert StakeStillLocked();

        uint256 rewards = calculateRewards(userStake);
        uint256 developerFee = (rewards * DEVELOPER_FEE_PERCENTAGE) /
            PERCENTAGE_BASE;
        uint256 userRewards = rewards - developerFee;

        userStake.claimed = true;

        // Transferir capital + recompensas al usuario
        cCOP.safeTransfer(msg.sender, userStake.amount + userRewards);
        cCOP.safeTransfer(developerWallet, developerFee);

        emit Withdrawn(msg.sender, userStake.amount, userRewards);
        emit DeveloperFeesPaid(developerWallet, developerFee);
    }

    /**
     * @notice Calcula las recompensas de un staking.
     * @param _stake Estructura de staking del usuario.
     * @return Recompensa generada en cCOP (redondeo hacia abajo debido a divisiones enteras).
     */
    function calculateRewards(
        Stake memory _stake
    ) public view returns (uint256) {
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

        // Calcular intereses basados en la tasa nominal mensual
        uint256 monthlyInterest = (_stake.amount * rate) / RATE_BASE;
        
        // Calcular intereses totales según la duración
        uint256 totalInterest;
        if (_stake.duration == DAYS_30) {
            totalInterest = monthlyInterest;
        } else if (_stake.duration == DAYS_60) {
            totalInterest = monthlyInterest * 2;
        } else if (_stake.duration == DAYS_90) {
            totalInterest = monthlyInterest * 3;
        }

        // Aplicar distribución del pool de intereses
        uint256 poolShare = (interestPool * distribution) / 100;
        return totalInterest > poolShare ? poolShare : totalInterest;
    }

    /** 
     * @notice Obtiene el límite máximo de staking según la duración.
     * @param _duration Duración del staking.
     * @return Límite máximo de staking en cCOP.
     */
    function getMaxStakeAmount(
        uint256 _duration
    ) public pure returns (uint256) {
        if (_duration == DAYS_30) return MAX_STAKE_30;
        if (_duration == DAYS_60) return MAX_STAKE_60;
        if (_duration == DAYS_90) return MAX_STAKE_90;
        return 0;
    }

    /**
     * @notice Obtiene todos los stakes de un usuario.
     * @param _user Dirección del usuario.
     * @return Array de estructuras Stake.
     */
    function getUserStakes(
        address _user
    ) external view returns (Stake[] memory) {
        return stakes[_user];
    }

    /**
     * @notice Obtiene una parte (paginada) de los stakes de un usuario.
     * @param _user Dirección del usuario.
     * @param _offset Índice inicial desde el que se retornarán stakes.
     * @param _limit Número máximo de stakes a retornar.
     * @return Array de stakes correspondiente al rango solicitado.
     */
    function getUserStakesPaginated(
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (Stake[] memory) {
        Stake[] memory userStakes = stakes[_user];
        uint256 total = userStakes.length;
        if (_offset >= total) {
            return new Stake[](0);
        }
        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }
        uint256 count = end - _offset;
        Stake[] memory result = new Stake[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = userStakes[_offset + i];
        }
        return result;
    }

    /**
     * @notice Obtiene el número total de stakes activos en un rango paginado.
     * @param _user Dirección del usuario.
     * @param _offset Índice inicial en el array de stakes.
     * @param _limit Número máximo de stakes a evaluar.
     * @return activeStakes Número de stakes activos (no reclamados y aún bloqueados) en el rango.
     */
    function getTotalActiveStakesPaginated(
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256 activeStakes) {
        Stake[] memory userStakes = stakes[_user];
        uint256 total = userStakes.length;
        for (uint256 i = _offset; i < total && i < _offset + _limit; i++) {
            if (
                !userStakes[i].claimed &&
                block.timestamp < userStakes[i].endTime
            ) {
                activeStakes++;
            }
        }
    }

    /**
     * @notice Permite actualizar la wallet del desarrollador.
     * @dev Sólo puede ser ejecutada por la gobernanza (por ejemplo, multisig).
     * @param _newWallet Nueva dirección de la wallet del desarrollador.
     */
    function updateDeveloperWallet(address _newWallet) external onlyGovernance {
        require(_newWallet != address(0), "Invalid wallet address");
        address oldWallet = developerWallet;
        developerWallet = _newWallet;
        emit DeveloperWalletUpdated(oldWallet, _newWallet);
    }

    /**
     * @notice Permite actualizar la dirección de gobernanza.
     * @dev Sólo puede ser ejecutada por el owner.
     * @param _newGovernance Nueva dirección de gobernanza (por ejemplo, un multisig).
     */
    function updateGovernance(address _newGovernance) external onlyGovernance {
        if (_newGovernance == address(0)) revert InvalidParameter();
        address oldGovernance = governance;
        governance = _newGovernance;
        emit GovernanceUpdated(oldGovernance, _newGovernance);
    }

    // Nuevas funciones de gobernanza
    function updateStakingRates(
        uint256 _rate30,
        uint256 _rate60,
        uint256 _rate90
    ) external onlyGovernance nonReentrant {
        if (_rate30 == 0 || _rate60 == 0 || _rate90 == 0)
            revert InvalidParameter();
        stakingRate30Days = _rate30;
        stakingRate60Days = _rate60;
        stakingRate90Days = _rate90;
        emit RatesUpdated(_rate30, _rate60, _rate90);
    }

    // Nueva función para recuperar tokens no reclamados
    function sweepUnclaimedTokens(
        uint256 _daysThreshold
    ) external onlyGovernance nonReentrant {
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

    /**
     * @notice Agrega una dirección a la lista blanca
     * @param _user Dirección a agregar a la lista blanca
     */
    function addToWhitelist(address _user) external onlyGovernance {
        if (_user == address(0)) revert InvalidParameter();
        whitelisted[_user] = true;
        emit WhitelistUpdated(_user, true);
    }

    /**
     * @notice Remueve una dirección de la lista blanca
     * @param _user Dirección a remover de la lista blanca
     */
    function removeFromWhitelist(address _user) external onlyGovernance {
        if (_user == address(0)) revert InvalidParameter();
        whitelisted[_user] = false;
        emit WhitelistUpdated(_user, false);
    }

    /**
     * @notice Agrega múltiples direcciones a la lista blanca
     * @param _users Array de direcciones a agregar
     */
    function addMultipleToWhitelist(address[] calldata _users) external onlyGovernance {
        for (uint256 i = 0; i < _users.length; i++) {
            if (_users[i] == address(0)) revert InvalidParameter();
            whitelisted[_users[i]] = true;
            emit WhitelistUpdated(_users[i], true);
        }
    }
}
