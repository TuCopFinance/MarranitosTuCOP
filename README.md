# 🔗 Smart Contract de Staking

## 📝 Descripción
Smart contract de staking desarrollado con Solidity y Hardhat que permite a los usuarios hacer staking de tokens y recibir recompensas.

## 🛠 Tecnologías
- Solidity ^0.8.20
- Hardhat
- Ethers.js
- OpenZeppelin Contracts

## 🚀 Instalación

1. Clona el repositorio

# 📘 Contrato de Staking cCOP

## 📌 Descripción General

Este contrato inteligente permite a los usuarios hacer staking de tokens cCOP para recibir recompensas basadas en diferentes períodos de tiempo. **Importante: Solo los usuarios incluidos en la lista blanca pueden participar en el staking.** El contrato incluye características avanzadas como lista blanca de usuarios, paginación para consultas eficientes y un sistema de gobernanza para gestionar parámetros críticos.

## ⚠️ Requisito Fundamental: Lista Blanca

Para utilizar el contrato, los usuarios **deben estar incluidos en la lista blanca** previamente por los administradores del contrato. Cualquier intento de hacer staking desde una dirección no incluida en la lista blanca será rechazado por el contrato.

## 🔒 Períodos de Staking Disponibles

El contrato ofrece tres períodos de bloqueo para staking:

- **30 días**: Ideal para inversiones a corto plazo
- **60 días**: Para inversores de mediano plazo
- **90 días**: Para maximizar rendimientos a largo plazo

## 💰 Tasas de Interés y Distribución

| Período | Tasa Nominal Mensual | Distribución de Pool |
|---------|----------------------|----------------------|
| 30 días | 1.25%                | 40%                  |
| 60 días | 1.50%                | 35%                  |
| 90 días | 2.00%                | 25%                  |

## 📊 Límites de Staking 

Para asegurar la sostenibilidad del sistema, se han establecido los siguientes límites:

| Período | Límite Máximo (cCOP)  |
|---------|------------------------|
| 30 días | 3,160,493,827 cCOP     |
| 60 días | 2,264,877,414 cCOP     |
| 90 días | 1,177,902,918 cCOP     |

## 🔄 Casos de Uso

### 1. Gestión de Lista Blanca
Solo los usuarios incluidos en la lista blanca por la gobernanza pueden participar en el staking. Este es un requisito previo para utilizar cualquier otra funcionalidad.

```solidity
function addToWhitelist(address _user) external onlyGovernance
function removeFromWhitelist(address _user) external onlyGovernance
function addMultipleToWhitelist(address[] calldata _users) external onlyGovernance
function isWhitelisted(address _user) public view returns (bool)
```

### 2. Staking de Tokens
Los usuarios en lista blanca pueden depositar sus tokens cCOP eligiendo uno de los tres períodos disponibles. Los tokens quedarán bloqueados hasta finalizar el período seleccionado.

```solidity
function stake(uint256 _amount, uint256 _duration) external onlyWhitelisted
```

### 3. Retiro de Tokens y Recompensas
Una vez finalizado el período de staking, los usuarios pueden retirar su capital inicial más las recompensas generadas.

```solidity
function withdraw(uint256 _stakeIndex) external
```

### 4. Consulta de Staking Activos
Los usuarios pueden consultar todos sus stakes activos o utilizar la paginación para obtener resultados más específicos.

```solidity
function getUserStakes(address _user) external view
function getUserStakesPaginated(address _user, uint256 _offset, uint256 _limit) external view
function getTotalActiveStakesPaginated(address _user, uint256 _offset, uint256 _limit) external view
```

### 5. Funciones de Gobernanza
La gobernanza puede actualizar parámetros críticos como las tasas de interés y recuperar tokens no reclamados.

```solidity
function updateDeveloperWallet(address _newWallet) external onlyGovernance
function updateGovernance(address _newGovernance) external onlyGovernance
function updateStakingRates(uint256 _rate30, uint256 _rate60, uint256 _rate90) external onlyGovernance
function sweepUnclaimedTokens(uint256 _daysThreshold) external onlyGovernance
```

## 📈 Cálculo de Recompensas

Las recompensas se calculan en base a la tasa nominal mensual y se pagan al finalizar el período de staking. Se aplica una comisión del 5% sobre las recompensas generadas, destinada al desarrollador.

```solidity
function calculateRewards(Stake memory _stake) public view returns (uint256)
```

## 🔐 Distribución de Intereses

El contrato mantiene un pool de intereses, distribuido proporcionalmente entre los diferentes períodos de staking:
- 40% para staking de 30 días
- 35% para staking de 60 días
- 25% para staking de 90 días

## 🛠️ Tecnologías Utilizadas

- **Solidity ^0.8.20**: Lenguaje de programación para el contrato
- **OpenZeppelin**: Implementaciones estándar de tokens ERC20, seguridad y control de acceso
- **SafeERC20**: Para transferencias seguras de tokens
- **ReentrancyGuard**: Protección contra ataques de reentrancia
- **Ownable**: Control de propiedad y permisos

## 📄 Licencia

Este contrato está licenciado bajo MIT.

## 📂 Contacto y Soporte

Para consultas o soporte, puedes contactarnos en [[intechchain](https://intechchain.com/)].

