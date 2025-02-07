export const web3authConfig = {
    clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID,
    web3AuthNetwork: "mainnet",
    chainConfig: {
        chainNamespace: "eip155",
        chainId: "0xa4ec", // Celo Mainnet
        rpcTarget: "https://forno.celo.org",
        displayName: "Celo",
        blockExplorer: "https://celoscan.io",
        ticker: "CELO",
        tickerName: "CELO"
    }
}; 