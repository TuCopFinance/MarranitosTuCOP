const hre = require("hardhat");

async function main() {
  // Obtener las variables de entorno
  const developerWallet = process.env.DEVELOPER_WALLET;
  const cCOPAddress = process.env.CCOP_TOKEN_ADDRESS;
  
  // Obtener la información de la red
  const network = hre.network;

  if (!developerWallet || !cCOPAddress) {
    throw new Error("Falta configurar DEVELOPER_WALLET o CCOP_TOKEN_ADDRESS en el archivo .env");
  }

  console.log("Desplegando cCOPStaking...");
  console.log("Red:", network.name);
  console.log("Developer Wallet:", developerWallet);
  console.log("Token cCOP:", cCOPAddress);

  // Configurar opciones de gas
  const deployOptions = {
    gasLimit: 10000000, // Límite de gas mucho más alto
    gasPrice: 50000000000 // Precio de gas explícito (50 Gwei)
  };

  // Desplegar el contrato
  const cCOPStaking = await hre.ethers.deployContract("cCOPStaking", [
    cCOPAddress,
    developerWallet
  ], deployOptions);

  await cCOPStaking.waitForDeployment();

  console.log("cCOPStaking desplegado en:", await cCOPStaking.getAddress());

  // Solo verificar si no estamos en la red local
  if (network.name !== "hardhat" && network.name !== "localhost") {
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