// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title cCOP Staking Contract
 * @dev Contrato de staking exclusivo para el token cCOP, con períodos de 30, 60 y 90 días.
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

    mapping(address => Stake[]) public stakes; // Registro de stakes por usuario

    uint256 private constant DAYS_30 = 30 days;
    uint256 private constant DAYS_60 = 60 days;
    uint256 private constant DAYS_90 = 90 days;

    uint256 private constant DEVELOPER_FEE_PERCENTAGE = 5; // 5% de comisión para el desarrollador
    uint256 private constant PERCENTAGE_BASE = 100;

    // Límites de staking
    uint256 public constant MAX_STAKE_30 = 3160493827 * 1e18;
    uint256 public constant MAX_STAKE_60 = 2264877414 * 1e18;
    uint256 public constant MAX_STAKE_90 = 1177902918 * 1e18;

    // Tasas de interés (base 10000)
    uint256 private constant RATE_30_DAYS = 125; // 1.25%
    uint256 private constant RATE_60_DAYS = 150; // 1.50%
    uint256 private constant RATE_90_DAYS = 200; // 2.00%
    uint256 private constant RATE_BASE = 10000;

    // Eventos
    event Staked(address indexed user, uint256 amount, uint256 duration);
    event Withdrawn(address indexed user, uint256 amount, uint256 rewards);
    event DeveloperFeesPaid(address indexed developer, uint256 amount);
    event DeveloperWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet
    );

    // Errores personalizados
    error InvalidStakingPeriod();
    error ExceedsStakingLimit();

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
    }

    /**
     * @notice Permite a los usuarios hacer staking de cCOP.
     * @param _amount Cantidad de cCOP a hacer stake.
     * @param _duration Duración del staking (30, 60 o 90 días).
     */
    function stake(uint256 _amount, uint256 _duration) external nonReentrant {
        if (
            _duration != DAYS_30 && _duration != DAYS_60 && _duration != DAYS_90
        ) {
            revert InvalidStakingPeriod();
        }
        require(_amount > 0, "Amount must be greater than 0");

        // Verificar límites según la duración
        if (_amount > getMaxStakeAmount(_duration)) {
            revert ExceedsStakingLimit();
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
        Stake storage userStake = stakes[msg.sender][_stakeIndex];
        require(!userStake.claimed, "Already claimed");
        require(block.timestamp >= userStake.endTime, "Stake still locked");

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
     * @return Recompensa generada en cCOP.
     */
    function calculateRewards(
        Stake memory _stake
    ) public pure returns (uint256) {
        uint256 rate;
        if (_stake.duration == DAYS_30) {
            rate = RATE_30_DAYS;
        } else if (_stake.duration == DAYS_60) {
            rate = RATE_60_DAYS;
        } else if (_stake.duration == DAYS_90) {
            rate = RATE_90_DAYS;
        }

        return (_stake.amount * rate) / RATE_BASE;
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
     * @notice Permite al owner retirar todos los fondos en caso de emergencia.
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = cCOP.balanceOf(address(this));
        cCOP.safeTransfer(owner(), balance);
    }

    /**
     * @notice Permite actualizar la wallet del desarrollador.
     * @param _newWallet Nueva dirección de la wallet del desarrollador.
     */
    function updateDeveloperWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Invalid wallet address");
        address oldWallet = developerWallet;
        developerWallet = _newWallet;
        emit DeveloperWalletUpdated(oldWallet, _newWallet);
    }

    /**
     * @notice Obtiene el total de stakes activos de un usuario.
     * @param _user Dirección del usuario.
     * @return Número total de stakes activos.
     */
    function getTotalActiveStakes(
        address _user
    ) external view returns (uint256) {
        uint256 activeStakes = 0;
        Stake[] memory userStakes = stakes[_user];

        for (uint256 i = 0; i < userStakes.length; i++) {
            if (
                !userStakes[i].claimed &&
                block.timestamp < userStakes[i].endTime
            ) {
                activeStakes++;
            }
        }

        return activeStakes;
    }
}
