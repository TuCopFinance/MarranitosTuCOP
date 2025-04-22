// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DispersionContract
 * @dev Contrato para dispersar una cantidad fija de CELO a una dirección específica
 * con autorización de gobernanza.
 */
contract DispersionContract is ReentrancyGuard {
    // Dirección del contrato de gobernanza
    address public governance;

    // Dirección del contrato de dispersión
    address public dispersion;

    // Cantidad fija a dispersar
    uint256 public fixedAmount;

    // Eventos
    event CeloDispersed(address indexed recipient, uint256 amount);
    event GovernanceUpdated(
        address indexed oldGovernance,
        address indexed newGovernance
    );
    event DispersionUpdated(
        address indexed oldDispersion,
        address indexed newDispersion
    );
    event FixedAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event CeloWithdrawn(address indexed recipient, uint256 amount);

    /**
     * @dev Constructor del contrato
     * @param _governance Dirección del contrato de gobernanza
     * @param _dispersion Dirección del contrato de dispersión
     * @param _fixedAmount Cantidad fija de CELO a dispersar
     */
    constructor(
        address _governance,
        address _dispersion,
        uint256 _fixedAmount
    ) {
        require(_governance != address(0), "Invalid governance address");
        require(_dispersion != address(0), "Invalid dispersion address");
        require(_fixedAmount > 0, "Invalid fixed amount");

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
     * @dev Dispersa la cantidad fija de CELO a una dirección específica
     * @param _recipient Dirección que recibirá el CELO
     */
    function disperseCelo(
        address _recipient
    ) external onlyDispersion nonReentrant {
        // Verificar balance del contrato
        require(
            address(this).balance >= fixedAmount,
            "Insufficient contract balance"
        );

        // Transferir CELO al destinatario
        (bool success, ) = _recipient.call{value: fixedAmount}("");
        require(success, "CELO transfer failed");

        emit CeloDispersed(_recipient, fixedAmount);
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
     * @dev Permite al governance actualizar la dirección de dispersión
     * @param _newDispersion Nueva dirección que tendrá el rol de dispersión
     */
    function updateDispersion(
        address _newDispersion
    ) external onlyGovernance {
        require(_newDispersion != address(0), "Invalid dispersion address");
        require(_newDispersion != dispersion, "New dispersion same as current");

        address oldDispersion = dispersion;
        dispersion = _newDispersion;

        emit DispersionUpdated(oldDispersion, _newDispersion);
    }

    /**
     * @dev Permite al governance actualizar la cantidad fija de CELO a dispersar
     * @param _newFixedAmount Nueva cantidad fija de CELO
     */
    function updateFixedAmount(
        uint256 _newFixedAmount
    ) external onlyGovernance {
        require(_newFixedAmount > 0, "Invalid fixed amount");

        uint256 oldAmount = fixedAmount;
        fixedAmount = _newFixedAmount;

        emit FixedAmountUpdated(oldAmount, _newFixedAmount);
    }

    /**
     * @dev Permite al governance retirar todo el CELO del contrato
     */
    function withdrawCelo() external onlyGovernance nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No CELO to withdraw");

        (bool success, ) = governance.call{value: balance}("");
        require(success, "CELO transfer failed");

        emit CeloWithdrawn(governance, balance);
    }

    // Función para recibir CELO
    receive() external payable {}
}
