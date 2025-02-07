const hre = require("hardhat");

async function main() {
  // Obtener las variables de entorno
  const developerWallet = process.env.DEVELOPER_WALLET;
  const cCOPAddress = process.env.CCOP_TOKEN_ADDRESS;

  if (!developerWallet || !cCOPAddress) {
    throw new Error("Falta configurar DEVELOPER_WALLET o CCOP_TOKEN_ADDRESS en el archivo .env");
  }

  console.log("Desplegando cCOPStaking...");
  console.log("Red:", network.name);
  console.log("Developer Wallet:", developerWallet);
  console.log("Token cCOP:", cCOPAddress);

  // Desplegar el contrato
  const cCOPStaking = await hre.ethers.deployContract("cCOPStaking", [
    cCOPAddress,
    developerWallet
  ]);

  await cCOPStaking.waitForDeployment();

  console.log("cCOPStaking desplegado en:", await cCOPStaking.getAddress());

  // Esperar para la verificación
  console.log("Esperando 5 bloques para la verificación...");
  await cCOPStaking.deploymentTransaction().wait(5);

  // Verificar el contrato
  console.log("Verificando contrato...");
  try {
    await hre.run("verify:verify", {
      address: await cCOPStaking.getAddress(),
      constructorArguments: [cCOPAddress, developerWallet],
    });
    console.log("Contrato verificado exitosamente");
  } catch (error) {
    console.error("Error en la verificación:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 