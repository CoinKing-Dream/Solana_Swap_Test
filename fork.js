const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { Jupiter } = require('@jup-ag/core');
const bs58 = require('bs58');
const { default: cluster } = require('cluster');
const { resolve } = require('path');

// Configuration
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL);
const SECRET_KEY_STRING = 'PRIVATE-KEY-WALLET';

let wallet, jupiter;

const LAMPORTS = 1_000_000_000;
const MAXRETRIES = 5;

const 
    AMOUNT = 0.01,
    FROM_ADDRESS = 'So11111111111111111111111111111111111111112',
    TO_ADDRESS = '9oUXhgFmW2HWqWHds1NoV3DKLY3AAtNevA3dP7PtyEbr';

async function loadJupiterConnectionWithRetries(connection, wallet) {
    let attempt = 0, delay = 1000;
    while ( attempt < MAXRETRIES ) {
        try {
            console.log(`Attempting to Load Jupiter Client : ${attempt + 1}`);
            const jupiter = await Jupiter.load({
                connection,
                cluster: 'mainnet-beta',
                user: wallet
            });
            console.log("Jupiter Client loaded Successfully.");
            return jupiter;
        } catch (error) {
            console.log("Failed to Load Jupiter Client: ", error.message);
            if (error.message.includes("429")) {
                attempt ++;
                console.log(`Waiting for ${delay / 1000} seconds for retrying...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                throw error;
            }
        }
    }
    throw new Error('Failed to load Jupiter client after Max Retries.');
}

async function checkBalance(publicKey) {
    try {
        let balanceLamports = await connection.getBalance(new PublicKey(publicKey));
        let balanceSol = balanceLamports / LAMPORTS;
        console.log(`Current Wallet's Balance: ${balanceSol.toFixed(9)} SOL`);
    } catch (error) {
        console.error("Failed to Fetch Balance:", error);
    }
}

async function swapTokens(amount, fromAddress, toAddress, slippagePercent = 10) {
    try {
        const SECRET_KEY = new Uint8Array(bs58.decode(SECRET_KEY_STRING));
        wallet = Keypair.fromSecretKey(SECRET_KEY);
        console.log("Wallet loaded successfully with Public Key:", wallet.publicKey.toString());;
    } catch (error) {
        console.error('Error decoding the Secret Key or Loading the wallet:', error);
        process.exit(1);
    }

    await checkBalance(wallet.publicKey.toString());

    try {
        jupiter = await loadJupiterConnectionWithRetries(connection, wallet);
        const 
            routes = await jupiter.computeRoutes({
                inputAddress: new PublicKey(fromAddress),
                outputAddress: new PublicKey(toAddress),
                inputAddress: amount,
                slippage: slippagePercent,
                userPublickKey: wallet.publicKey
            });
        
        if (routes && routes.routesInfos.length > 0) {
            const bestRoute = routes.routesInfos[0];
            const swapResult = await jupiter.exchange({
                routeInfo: bestRoute,
                user: wallet,
                onComplete: (txId) => console.log(`Swap completed with Transaction ID: ${txId}`),   
                onError: error => console.error(`Swap failed with error: ${error}`)
            });
        } else {
            console.log("No suitable route found for the swap");
        }
    } catch (error) {
        console.error(`Error during swap: ${error}`);
    }
}

swapTokens(AMOUNT, FROM_ADDRESS, TO_ADDRESS);
