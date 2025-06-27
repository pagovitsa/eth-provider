#!/usr/bin/env node

import { IPCProvider } from './src/ipc-provider.js';

async function testGethIPC() {
    console.log('Testing IPC connection to geth at /home/chain/exec/geth.ipc...');
    
    const provider = new IPCProvider('/home/chain/exec/geth.ipc', {
        cacheEnabled: true,
        batchRequests: false,
        autoReconnect: true,
        requestTimeout: 30000,
        reconnectDelay: 1000,
        maxReconnects: 5
    });

    try {
        console.log('1. Testing basic connection and chain ID...');
        const chainId = await provider.request({
            method: 'eth_chainId',
            params: []
        });
        console.log(`✅ Chain ID: ${chainId}`);

        console.log('\n2. Testing block number...');
        const blockNumber = await provider.request({
            method: 'eth_blockNumber',
            params: []
        });
        console.log(`✅ Current block number: ${parseInt(blockNumber, 16)}`);

        console.log('\n3. Testing net version...');
        const netVersion = await provider.request({
            method: 'net_version',
            params: []
        });
        console.log(`✅ Network version: ${netVersion}`);

        console.log('\n4. Testing latest block...');
        const latestBlock = await provider.request({
            method: 'eth_getBlockByNumber',
            params: ['latest', false]
        });
        console.log(`✅ Latest block hash: ${latestBlock.hash}`);
        console.log(`✅ Latest block number: ${parseInt(latestBlock.number, 16)}`);
        console.log(`✅ Latest block timestamp: ${new Date(parseInt(latestBlock.timestamp, 16) * 1000).toISOString()}`);

        console.log('\n5. Testing gas price...');
        const gasPrice = await provider.request({
            method: 'eth_gasPrice',
            params: []
        });
        console.log(`✅ Current gas price: ${parseInt(gasPrice, 16)} wei`);

        console.log('\n6. Testing syncing status...');
        const syncing = await provider.request({
            method: 'eth_syncing',
            params: []
        });
        if (syncing === false) {
            console.log('✅ Node is fully synced');
        } else {
            console.log(`🔄 Node is syncing: current block ${parseInt(syncing.currentBlock, 16)}, highest block ${parseInt(syncing.highestBlock, 16)}`);
        }

        console.log('\n7. Testing multiple concurrent requests...');
        const start = Date.now();
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(provider.request({
                method: 'eth_blockNumber',
                params: []
            }));
        }
        
        const results = await Promise.all(promises);
        const end = Date.now();
        console.log(`✅ 10 concurrent requests completed in ${end - start}ms`);
        console.log(`✅ All requests returned the same block number: ${results.every(r => r === results[0])}`);

        console.log('\n8. Testing provider utility methods...');
        const blockNumberUtil = await provider.getBlockNumber();
        console.log(`✅ getBlockNumber() utility: ${blockNumberUtil}`);

        const balanceUtil = await provider.getBalance('0x0000000000000000000000000000000000000000');
        console.log(`✅ getBalance() utility for zero address: ${balanceUtil}`);

        // Test provider metrics if available
        if (provider.getMetrics) {
            console.log('\n9. Provider metrics...');
            const metrics = provider.getMetrics();
            console.log(`✅ Metrics:`, metrics);
        }

        console.log('\n🎉 All IPC provider tests passed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        // Clean up connection
        if (provider.disconnect) {
            await provider.disconnect();
            console.log('✅ Provider disconnected cleanly');
        }
    }
}

testGethIPC().catch(console.error);
