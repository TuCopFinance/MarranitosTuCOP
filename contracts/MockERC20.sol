// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @dev Token ERC20 simple para pruebas.
 */
contract MockERC20 is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev Permite al propietario crear más tokens.
     * @param to Dirección que recibirá los tokens.
     * @param amount Cantidad de tokens a crear.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
} 