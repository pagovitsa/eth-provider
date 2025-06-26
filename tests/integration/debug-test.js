import { IPCProvider } from '../../index.js';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

const sleep = promisify(setTimeout);

/**
 * Debug Test - Raw IPC Communication
 */
async function runDebugTest() {
    console.log('🔍 Debug Test - Raw IPC Communication\n');
    console.log('====================================\n');

    const IPC_PATH = '/tmp/anvil-debug.ipc';
    let anvil;
    let provider;

    try {
        // Cleanup any existing IPC file
        if (existsSync(IPC_PATH)) {
            await unlink(IPC_PATH);
        }

        console.log('📋 Starting Anvil Node...');
        
        // Start Anvil with IPC support and verbose output
        anvil = spawn('anvil', ['--ipc', IPC_PATH]);
        
        // Wait for Anvil to start
        await sleep(3000);
        
        console.log('✅ Anvil node started');

        // Initialize provider with debug logging
        provider = new IPCProvider(IPC_PATH, {
            cacheEnabled: false, // Disable cache for debugging
            batchRequests: false, // Disable batching
            metricsEnabled: true,
            requestTimeout: 10000,
            logger: {
                log: console.log,
                error: console.error,
                warn: console.warn,
                info: console.info
            }
        });

        console.log('📋 Connecting to node...');
        await provider.connect();
        console.log('✅ Connected successfully');

        console.log('📋 Testing raw request...');
        
        // Test with the most basic request
        try {
            console.log('Sending eth_blockNumber request...');
            const result = await provider.request('eth_blockNumber', []);
            console.log(`✅ Block number result: ${result}`);
        } catch (error) {
            console.log(`❌ eth_blockNumber failed: ${error.message}`);
            console.log('Error details:', error);
        }

        // Test with eth_accounts
        try {
            console.log('Sending eth_accounts request...');
            const result = await provider.request('eth_accounts', []);
            console.log(`✅ Accounts result:`, result);
        } catch (error) {
            console.log(`❌ eth_accounts failed: ${error.message}`);
            console.log('Error details:', error);
        }

        // Test with net_version
        try {
            console.log('Sending net_version request...');
            const result = await provider.request('net_version', []);
            console.log(`✅ Net version result: ${result}`);
        } catch (error) {
            console.log(`❌ net_version failed: ${error.message}`);
            console.log('Error details:', error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
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
runDebugTest().catch(console.error);
