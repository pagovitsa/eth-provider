#!/usr/bin/env node

import { IPCProvider } from './src/ipc-provider.js';

async function comprehensiveTest() {
    console.log('🚀 Comprehensive IPC Provider Test with Geth');
    console.log('=' .repeat(50));
    
    const provider = new IPCProvider('/home/chain/exec/geth.ipc', {
        cacheEnabled: true,
        batchRequests: false,
        autoReconnect: true,
        requestTimeout: 5000
    });
    
    try {
        // Test 1: Basic connection
        console.log('\n1️⃣  Testing basic connection...');
        const chainId = await provider.request({
            method: 'eth_chainId',
            params: []
        });
        console.log(`   Chain ID: ${chainId} (${parseInt(chainId, 16)})`);

        // Test 2: Block information
        console.log('\n2️⃣  Testing block information...');
        const blockNumber = await provider.request({
            method: 'eth_blockNumber',
            params: []
        });
        const blockNum = parseInt(blockNumber, 16);
        console.log(`   Current block: ${blockNum}`);

        // Test 3: Network info
        console.log('\n3️⃣  Testing network information...');
        const netVersion = await provider.request({
            method: 'net_version',
            params: []
        });
        console.log(`   Network version: ${netVersion}`);

        // Test 4: Sync status
        console.log('\n4️⃣  Testing sync status...');
        const syncing = await provider.request({
            method: 'eth_syncing',
            params: []
        });
        
        if (syncing === false) {
            console.log('   ✅ Node is fully synced');
        } else {
            const current = parseInt(syncing.currentBlock, 16);
            const highest = parseInt(syncing.highestBlock, 16);
            const progress = ((current / highest) * 100).toFixed(2);
            console.log(`   🔄 Syncing: ${current}/${highest} (${progress}%)`);
        }

        // Test 5: Performance test
        console.log('\n5️⃣  Testing performance (10 concurrent requests)...');
        const start = Date.now();
        const promises = Array(10).fill().map(() => 
            provider.request({
                method: 'eth_blockNumber',
                params: []
            })
        );
        
        await Promise.all(promises);
        const duration = Date.now() - start;
        console.log(`   ⚡ 10 requests completed in ${duration}ms`);
        console.log(`   📊 Average: ${(duration/10).toFixed(1)}ms per request`);

        // Test 6: Utility methods
        console.log('\n6️⃣  Testing utility methods...');
        if (provider.getBlockNumber) {
            const utilBlock = await provider.getBlockNumber();
            console.log(`   getBlockNumber(): ${utilBlock}`);
        }
        
        if (provider.getBalance) {
            const balance = await provider.getBalance('0x0000000000000000000000000000000000000000');
            console.log(`   getBalance(zero address): ${balance}`);
        }

        console.log('\n🎉 All tests completed successfully!');
        console.log('✅ IPC Provider is working perfectly with Geth');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.code) {
            console.error(`   Error code: ${error.code}`);
        }
    } finally {
        // Cleanup
        if (provider.disconnect) {
            provider.disconnect();
        }
        
        // Force exit after a short delay
        setTimeout(() => process.exit(0), 100);
    }
}

comprehensiveTest();
