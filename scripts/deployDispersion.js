const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Desplegando contratos con la cuenta:", deployer.address);

  // Obtener los parámetros de despliegue del ambiente
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const governanceAddress = process.env.GOVERNANCE_ADDRESS;
  const fixedAmount = process.env.FIXED_AMOUNT;

  if (!tokenAddress || !governanceAddress || !fixedAmount) {
    throw new Error("Falta configurar variables de ambiente: TOKEN_ADDRESS, GOVERNANCE_ADDRESS, FIXED_AMOUNT");
  }

  console.log("Token Address:", tokenAddress);
  console.log("Governance Address:", governanceAddress);
  console.log("Fixed Amount:", fixedAmount);

  // Desplegar el contrato
  const DispersionContract = await ethers.getContractFactory("DispersionContract");
  const dispersion = await DispersionContract.deploy(
    tokenAddress,
    governanceAddress,
    fixedAmount
  );

  await dispersion.waitForDeployment();
  const dispersionAddress = await dispersion.getAddress();

  console.log("DispersionContract desplegado en:", dispersionAddress);

  // Verificar el contrato en el explorador
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Verificando contrato...");
    await hre.run("verify:verify", {
      address: dispersionAddress,
      constructorArguments: [tokenAddress, governanceAddress, fixedAmount],
    });
    console.log("Contrato verificado");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 