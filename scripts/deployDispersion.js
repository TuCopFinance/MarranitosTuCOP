const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Desplegando contratos con la cuenta:", deployer.address);

  // Dirección del contrato de gobernanza (usamos la misma cuenta por ahora)
  const governanceAddress = deployer.address;
  
  // Dirección del contrato de dispersión (usamos la misma cuenta por ahora)
  const dispersionAddress = deployer.address;
  
  // Cantidad fija de ETH a dispersar (0.01 ETH)
  const fixedAmount = hre.ethers.parseEther("0.01");

  console.log("Governance Address:", governanceAddress);
  console.log("Dispersion Address:", dispersionAddress);
  console.log("Fixed Amount (ETH):", hre.ethers.formatEther(fixedAmount));

  // Desplegar el contrato
  const DispersionContract = await hre.ethers.getContractFactory("DispersionContract");
  const dispersionContract = await DispersionContract.deploy(
    governanceAddress,
    dispersionAddress,
    fixedAmount
  );

  await dispersionContract.waitForDeployment();
  const contractAddress = await dispersionContract.getAddress();
  console.log("DispersionContract desplegado en:", contractAddress);

  // Solo verificar si no estamos en la red local
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    // Esperar para la verificación
    console.log("Esperando 5 bloques para la verificación...");
    await dispersionContract.deploymentTransaction().wait(5);

    // Verificar el contrato
    console.log("Verificando contrato...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [governanceAddress, dispersionAddress, fixedAmount],
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