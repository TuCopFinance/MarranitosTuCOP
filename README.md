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

# 📘 Staking MarranitosTuCop


## 📌 Descripción

Este sistema de staking permite a los usuarios depositar fondos en COP o USDT y recibir intereses según el tiempo de bloqueo elegido (30, 60 o 90 días). Los intereses se calculan según tasas nominales y se distribuyen de manera proporcional. Además, el contrato incluye una tarifa del 5% sobre los intereses generados, destinada al desarrollador.

## 🚀 Características del Staking

### 🔹 Depósitos

- Se pueden realizar en **COP o USDT**.
- Límites de depósitos:
  - **COP**:
    - 30 días: \$3,160,493,827 COP
    - 60 días: \$2,264,877,414 COP
    - 90 días: \$1,177,902,918 COP
  - **USDT**:
    - 30 días: 734,999 USDT
    - 60 días: 526,716 USDT
    - 90 días: 273,931 USDT
- Los fondos se bloquean según el plazo elegido.

### 🔹 Cálculo de Intereses

- **Tasa nominal mensual**:
  - 30 días: **1.25%**
  - 60 días: **1.50%**
  - 90 días: **2.00%**
- **Distribución de intereses**:
  - 40% para 30 días
  - 35% para 60 días
  - 25% para 90 días
- Disponibilidad para pagos de intereses:
  - COP: **\$100,000,000**
  - USDT: **\$23,256**

### 🔹 Retiro y Fees

- Los intereses se pagan al finalizar el período de staking.
- Se cobra un **5% de los intereses** como fee para el developer.

## 📜 Funcionamiento del Smart Contract

1. **Los usuarios depositan fondos** en COP o USDT.
2. **Los fondos se bloquean** según el plazo elegido.
3. **El contrato calcula los intereses** en función del tiempo y la tasa nominal.
4. **Al finalizar el período, los usuarios pueden retirar su capital + intereses generados**.
5. **El developer recibe el 5% de los intereses generados**.

## 🛠 Tecnologías Utilizadas

- **Smart Contract en Solidity** para la lógica de staking.

## 📂 Contacto y Soporte

Para consultas o soporte, puedes contactarnos en [[tu correo o sitio web](https://intechchain.com/)].

