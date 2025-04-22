const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Desplegando contratos con la cuenta:", deployer.address);

  // Obtener los parámetros de despliegue del ambiente
  const tokenAddress = process.env.CCOP_TOKEN_ADDRESS;
  const governanceAddress = process.env.GOVERNANCE_ADDRESS;
  const dispersionAddresssc = process.env.DEVELOPER_WALLET;
  const fixedAmount = ethers.parseEther(process.env.FIXED_AMOUNT);

  if (!tokenAddress || !governanceAddress || !fixedAmount) {
    throw new Error("Falta configurar variables de ambiente: TOKEN_ADDRESS, GOVERNANCE_ADDRESS, FIXED_AMOUNT");
  }

  console.log("Token Address:", tokenAddress);
  console.log("Governance Address:", governanceAddress);
  console.log("Fixed Amount (wei):", fixedAmount.toString());

  // Desplegar el contrato
  const DispersionContract = await ethers.getContractFactory("DispersionContract");
  const dispersion = await DispersionContract.deploy(
    tokenAddress,
    governanceAddress,
    dispersionAddresssc,
    fixedAmount
  );

  await dispersion.waitForDeployment();
  const dispersionAddress = await dispersion.getAddress();

  console.log("DispersionContract desplegado en:", dispersionAddress);

  // Solo verificar si no estamos en la red local
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    // Esperar para la verificación
    console.log("Esperando 5 bloques para la verificación...");
    await dispersion.deploymentTransaction().wait(5);

    // Verificar el contrato
    console.log("Verificando contrato...");
    try {
      await hre.run("verify:verify", {
        address: dispersionAddress,
        constructorArguments: [tokenAddress, governanceAddress, dispersionAddresssc, fixedAmount],
      });
      console.log("Contrato verificado exitosamente");
    } catch (error) {
      console.error("Error en la verificación:", error);
    }
  } else {
    console.log("Saltando verificación en red local");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 