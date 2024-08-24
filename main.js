const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { Jupiter } = require('@jup-ag/core');
const bs58 = require('bs58');

// Configuration
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL);
const SECRET_KEY_STRING = "PRIVATE-KEY-WALLET";

let wallet;
let jupiter;

async function loadJupiterWithRetries(connection, wallet) {
    const maxRetries = 5;
    let attempt = 0;
    let delay = 1000;
    while (attempt < maxRetries) {
        try {
            console.log(`Attempting to load Jupiter client... Attempt ${attempt + 1}`);
            const jupiter = await Jupiter.load({ connection, cluster: 'mainnet-beta', user: wallet });
            console.log("Jupiter client loaded successfully.");
            return jupiter;
        } catch (error) {
            console.log(`Failed to load Jupiter client. Error: ${error.message}`);
            if (error.message.includes("429")) {
                attempt++;
                console.log(`Waiting for ${delay / 1000} seconds before retrying...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                throw error;
            }
        }
    }
    throw new Error('Failed to load Jupiter client after maximum retries.');
}

async function swapTokens(amount, fromMintAddress, toMintAddress, slippagePercentage = 10) {
    try {
        const SECRET_KEY = new Uint8Array(bs58.decode(SECRET_KEY_STRING));
        wallet = Keypair.fromSecretKey(SECRET_KEY);
        console.log("Wallet loaded successfully with public key:", wallet.publicKey.toString());
    } catch (error) {
        console.error('Error decoding the secret key or loading the wallet:', error);
        process.exit(1);
    }

    await checkBalance(wallet.publicKey.toString());

    try {
        jupiter = await loadJupiterWithRetries(connection, wallet);
        const routes = await jupiter.computeRoutes({
            inputMint: new PublicKey(fromMintAddress),
            outputMint: new PublicKey(toMintAddress),
            inputAmount: amount,
            slippage: slippagePercentage,
            userPublicKey: wallet.publicKey
        });

        if (routes && routes.routesInfos.length > 0) {
            const bestRoute = routes.routesInfos[0];
            console.log("Executing swap transaction...");
            const swapResult = await jupiter.exchange({
                routeInfo: bestRoute,
                user: wallet,
                onComplete: (txid) => console.log(`Swap completed with transaction ID: ${txid}`),
                onError: (error) => console.error(`Swap failed with error: ${error}`)
            });
            console.log(`Swap executed, transaction signature: ${swapResult.txid}`);
        } else {
            console.log("No suitable route found for the swap.");
        }
    } catch (error) {
        console.error(`Error during swap: ${error}`);
    }
}

async function checkBalance(publicKey) {
    try {
        let balanceLamports = await connection.getBalance(new PublicKey(publicKey));
        let balanceSOL = balanceLamports / 1_000_000_000;
        console.log(`Current balance: ${balanceSOL.toFixed(9)} SOL`);
        return balanceSOL;
    } catch (error) {
        console.error('Failed to fetch balance:', error);
        return 0;
    }
}


// THIS PART IS WRONG - I think the FORM_MINT_ADDRESS needs to be Solana I am not sure
const AMOUNT = 0.01;
const FROM_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';// THIS IS THE SOLANA ADDRESS ( I WANT TO PAY IN SOLANA )
const TO_MINT_ADDRESS = '9oUXhgFmW2HWqWHds1NoV3DKLY3AAtNevA3dP7PtyEbr'; // ANY TOKEN on WWW.DEXSCREENER.COM
swapTokens(AMOUNT, FROM_MINT_ADDRESS, TO_MINT_ADDRESS);
