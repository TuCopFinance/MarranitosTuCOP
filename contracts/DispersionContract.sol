// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DispersionContract
 * @dev Contrato para dispersar una cantidad fija de tokens a una dirección específica
 * con autorización de gobernanza.
 */
contract DispersionContract is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Dirección del contrato de gobernanza
    address public governance;

    // Dirección del contrato de dispersión
    address public dispersion;

    // Token a dispersar
    IERC20 public immutable token;

    // Cantidad fija a dispersar
    uint256 public fixedAmount;

    // Eventos
    event TokensDispersed(address indexed recipient, uint256 amount);
    event GovernanceUpdated(
        address indexed oldGovernance,
        address indexed newGovernance
    );
    event FixedAmountUpdated(uint256 oldAmount, uint256 newAmount);

    /**
     * @dev Constructor del contrato
     * @param _token Dirección del token a dispersar
     * @param _governance Dirección del contrato de gobernanza
     * @param _dispersion Dirección del contrato de dispersión
     * @param _fixedAmount Cantidad fija de tokens a dispersar
     */
    constructor(
        address _token,
        address _governance,
        address _dispersion,
        uint256 _fixedAmount
    ) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_governance != address(0), "Invalid governance address");
        require(_dispersion != address(0), "Invalid dispersion address");
        require(_fixedAmount > 0, "Invalid fixed amount");

        token = IERC20(_token);
        governance = _governance;
        dispersion = _dispersion;
        fixedAmount = _fixedAmount;
    }

    /**
     * @dev Modificador para verificar que el llamante es el contrato de gobernanza
     */
    modifier onlyGovernance() {
        require(msg.sender == governance, "Not authorized: only governance");
        _;
    }

    /**
     * @dev Modificador para verificar que el llamante es el contrato de dispersión
     */
    modifier onlyDispersion() {
        require(msg.sender == dispersion, "Not authorized: only dispersion");
        _;
    }

    /**
     * @dev Dispersa la cantidad fija de tokens a una dirección específica
     * @param _recipient Dirección que recibirá los tokens
     */
    function disperseTokens(
        address _recipient
    ) external onlyDispersion nonReentrant {
        // Verificar balance del contrato
        uint256 contractBalance = token.balanceOf(address(this));
        require(
            contractBalance >= fixedAmount,
            "Insufficient contract balance"
        );

        // Transferir tokens al destinatario
        token.safeTransfer(_recipient, fixedAmount);

        emit TokensDispersed(_recipient, fixedAmount);
    }

    /**
     * @dev Permite al owner retirar cualquier token que no sea el token principal
     * @param _token Dirección del token a retirar
     * @param _amount Cantidad de tokens a retirar
     */
    function withdrawOtherTokens(
        address _token,
        uint256 _amount
    ) external onlyGovernance {
        require(_token != address(token), "Cannot withdraw main token");
        IERC20(_token).safeTransfer(owner(), _amount);
    }

    /**
     * @dev Permite al governance actual transferir su rol a una nueva dirección
     * @param _newGovernance Nueva dirección que tendrá el rol de governance
     */
    function transferGovernance(
        address _newGovernance
    ) external onlyGovernance {
        require(_newGovernance != address(0), "Invalid governance address");
        require(_newGovernance != governance, "New governance same as current");

        address oldGovernance = governance;
        governance = _newGovernance;

        emit GovernanceUpdated(oldGovernance, _newGovernance);
    }

    /**
     * @dev Permite al governance actualizar la cantidad fija de tokens a dispersar
     * @param _newFixedAmount Nueva cantidad fija de tokens
     */
    function updateFixedAmount(
        uint256 _newFixedAmount
    ) external onlyGovernance {
        require(_newFixedAmount > 0, "Invalid fixed amount");

        uint256 oldAmount = fixedAmount;
        fixedAmount = _newFixedAmount;

        emit FixedAmountUpdated(oldAmount, _newFixedAmount);
    }
}
