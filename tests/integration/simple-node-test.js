import { IPCProvider } from '../../index.js';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

const sleep = promisify(setTimeout);

/**
 * Simple Node Integration Test
 * Basic connectivity and functionality test
 */
async function runSimpleNodeTest() {
    console.log('🔄 Running Simple Node Test\n');
    console.log('===========================\n');

    const IPC_PATH = '/tmp/anvil-simple.ipc';
    let anvil;
    let provider;

    try {
        // Cleanup any existing IPC file
        if (existsSync(IPC_PATH)) {
            await unlink(IPC_PATH);
        }

        console.log('📋 Starting Anvil Node...');
        
        // Start Anvil with IPC support
        anvil = spawn('anvil', ['--ipc', IPC_PATH, '--silent']);
        
        // Wait for Anvil to start
        await sleep(3000);
        
        console.log('✅ Anvil node started');

        // Initialize provider with shorter timeout
        provider = new IPCProvider(IPC_PATH, {
            cacheEnabled: true,
            batchRequests: false, // Disable batching for simpler testing
            metricsEnabled: true,
            requestTimeout: 5000 // 5 second timeout
        });

        console.log('📋 Connecting to node...');
        await provider.connect();
        console.log('✅ Connected successfully');

        console.log('📋 Testing basic methods...');
        
        // Test 1: Get accounts
        try {
            const accounts = await provider.accounts();
            console.log(`✅ Got ${accounts.length} accounts`);
            console.log(`First account: ${accounts[0]}`);
        } catch (error) {
            console.log(`❌ Failed to get accounts: ${error.message}`);
        }

        // Test 2: Get block number
        try {
            const blockNumber = await provider.getBlockNumber();
            console.log(`✅ Current block: ${blockNumber}`);
        } catch (error) {
            console.log(`❌ Failed to get block number: ${error.message}`);
        }

        // Test 3: Get chain ID
        try {
            const chainId = await provider.chainId();
            console.log(`✅ Chain ID: ${chainId}`);
        } catch (error) {
            console.log(`❌ Failed to get chain ID: ${error.message}`);
        }

        // Test 4: Mine a block
        try {
            const newBlock = await provider.mine();
            console.log(`✅ Mined block: ${newBlock}`);
        } catch (error) {
            console.log(`❌ Failed to mine block: ${error.message}`);
        }

        // Test 5: Get balance
        try {
            const accounts = await provider.accounts();
            if (accounts.length > 0) {
                const balance = await provider.getBalance(accounts[0]);
                console.log(`✅ Balance: ${provider.fromWei(balance)} ETH`);
            }
        } catch (error) {
            console.log(`❌ Failed to get balance: ${error.message}`);
        }

        // Show statistics
        const stats = provider.getStats();
        console.log('\n📊 Provider Statistics:');
        console.log(`- Total requests: ${stats.metrics.requests.total}`);
        console.log(`- Successful requests: ${stats.metrics.requests.successful}`);
        console.log(`- Failed requests: ${stats.metrics.requests.failed}`);
        console.log(`- Cache hit ratio: ${stats.cache.hitRatio}%`);

        console.log('\n🎉 Simple node test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        // Cleanup
        if (provider) {
            try {
                await provider.disconnect();
                console.log('✅ Provider disconnected');
            } catch (error) {
                console.log('⚠️  Error disconnecting provider:', error.message);
            }
        }
        
        if (anvil) {
            anvil.kill();
            console.log('✅ Anvil node stopped');
        }
        
        try {
            if (existsSync(IPC_PATH)) {
                await unlink(IPC_PATH);
                console.log('✅ IPC file cleaned up');
            }
        } catch (error) {
            console.error('⚠️  Error cleaning up:', error.message);
        }
    }
}

// Run test
runSimpleNodeTest().catch(console.error);
