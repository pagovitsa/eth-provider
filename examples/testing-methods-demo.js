import { IPCProvider } from '../index.js';

/**
 * Demonstration of custom testing and development methods
 * These methods are particularly useful for testing with Anvil/Hardhat
 */
async function demonstrateTestingMethods() {
    console.log('🧪 Testing & Development Methods Demo\n');
    console.log('====================================\n');

    // Initialize provider for testing environment
    const provider = new IPCProvider('/tmp/anvil.ipc', {
        cacheEnabled: true,
        batchRequests: true,
        metricsEnabled: true
    });

    try {
        console.log('📋 BLOCKCHAIN STATE MANAGEMENT');
        console.log('==============================');
        
        console.log('// Mine a new block');
        console.log('const newBlockNumber = await provider.mine();');
        console.log('console.log(`Mined block: ${newBlockNumber}`);\n');

        console.log('// Create a snapshot for testing');
        console.log('const snapshot = await provider.request("evm_snapshot", []);');
        console.log('console.log(`Snapshot created: ${snapshot}`);\n');

        console.log('// Reset to snapshot');
        console.log('await provider.snapreset();');
        console.log('console.log("Reverted to snapshot");\n');

        console.log('// Reset entire chain state');
        console.log('const resetResult = await provider.reset();');
        console.log('console.log(`Chain reset: ${resetResult}`);\n');

        console.log('📋 EVENT FILTERING METHODS');
        console.log('==========================');
        
        console.log('// Get mint events for a token contract');
        console.log('const mintEvents = await provider.getMint(');
        console.log('    "0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C", // Token contract');
        console.log('    0,        // From block 0');
        console.log('    "latest"  // To latest block');
        console.log(');');
        console.log('console.log(`Found ${mintEvents.length} mint events`);\n');

        console.log('// Get custom events with specific topics');
        console.log('const transferEvents = await provider.getPastLogs(');
        console.log('    "0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C", // Contract address');
        console.log('    0,        // From block');
        console.log('    "latest", // To block');
        console.log('    [         // Topics array');
        console.log('        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // Transfer event');
        console.log('        null, // Any from address');
        console.log('        "0x000000000000000000000000742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8"  // Specific to address');
        console.log('    ]');
        console.log(');');
        console.log('console.log(`Found ${transferEvents.length} transfer events`);\n');

        console.log('📋 COMPLETE TESTING WORKFLOW');
        console.log('============================');
        
        console.log('// 1. Setup test environment');
        console.log('await provider.reset();');
        console.log('console.log("Test environment reset");\n');

        console.log('// 2. Execute test transactions');
        console.log('const txHash = await provider.sendTransaction({');
        console.log('    from: "0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8",');
        console.log('    to: "0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C",');
        console.log('    value: provider.toWei("1", "ether"),');
        console.log('    gas: "21000"');
        console.log('});');
        console.log('console.log(`Transaction sent: ${txHash}`);\n');

        console.log('// 3. Mine block to confirm transaction');
        console.log('const blockNumber = await provider.mine();');
        console.log('console.log(`Transaction mined in block: ${blockNumber}`);\n');

        console.log('// 4. Verify transaction');
        console.log('const receipt = await provider.getTransactionReceipt(txHash);');
        console.log('console.log(`Transaction status: ${receipt.status}`);\n');

        console.log('// 5. Check events generated');
        console.log('const logs = await provider.getPastLogs(');
        console.log('    receipt.to,');
        console.log('    receipt.blockNumber,');
        console.log('    receipt.blockNumber,');
        console.log('    [] // All events');
        console.log(');');
        console.log('console.log(`Events generated: ${logs.length}`);\n');

        console.log('// 6. Reset for next test');
        console.log('await provider.snapreset();');
        console.log('console.log("Ready for next test");\n');

        console.log('📋 ADVANCED TESTING PATTERNS');
        console.log('============================');
        
        console.log('// Time manipulation');
        console.log('await provider.request("evm_increaseTime", [3600]); // +1 hour');
        console.log('await provider.mine(); // Mine to apply time change\n');

        console.log('// Set next block timestamp');
        console.log('const futureTime = Math.floor(Date.now() / 1000) + 86400; // +1 day');
        console.log('await provider.request("evm_setNextBlockTimestamp", [futureTime]);\n');

        console.log('// Impersonate account');
        console.log('await provider.request("anvil_impersonateAccount", ["0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8"]);\n');

        console.log('// Set account balance');
        console.log('await provider.request("anvil_setBalance", [');
        console.log('    "0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8",');
        console.log('    provider.toHex(provider.toWei("100", "ether"))');
        console.log(']);\n');

        console.log('// Set storage slot');
        console.log('await provider.request("anvil_setStorageAt", [');
        console.log('    "0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C", // Contract');
        console.log('    "0x0",                                        // Storage slot');
        console.log('    "0x" + "1".padStart(64, "0")                 // New value');
        console.log(']);\n');

        console.log('📊 TESTING UTILITIES');
        console.log('====================');
        
        console.log('// Batch multiple test operations');
        console.log('const testResults = await provider.batchRequest([');
        console.log('    { method: "eth_blockNumber", params: [] },');
        console.log('    { method: "eth_getBalance", params: ["0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8", "latest"] },');
        console.log('    { method: "eth_getTransactionCount", params: ["0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8", "latest"] }');
        console.log(']);');
        console.log('console.log(`Test data: ${JSON.stringify(testResults)}`);\n');

        // Show provider statistics
        const stats = provider.getStats();
        console.log('📊 PROVIDER STATISTICS');
        console.log('======================');
        console.log('Provider Performance:');
        console.log(`- Cache enabled: ${stats.cache.enabled}`);
        console.log(`- Batch processing: ${stats.batch ? 'enabled' : 'disabled'}`);
        console.log(`- Metrics tracking: ${stats.metrics.enabled}`);
        console.log(`- Object pooling: ${stats.pool.totalPoolSize} objects`);

    } catch (error) {
        console.error('❌ Demo error:', error.message);
        console.log('\n💡 Note: This demo shows testing method usage. Requires Anvil or similar testing client.');
    }

    console.log('\n✅ Testing methods demonstration complete!');
    console.log('\n📚 Custom Methods Summary:');
    console.log('==========================');
    console.log('✅ mine() - Mine a new block');
    console.log('✅ reset() - Reset chain state with forking');
    console.log('✅ snapreset() - Revert to snapshot or reset');
    console.log('✅ snapdelete() - Delete current snapshot');
    console.log('✅ getMint() - Get mint events for token contracts');
    console.log('✅ getPastLogs() - Get filtered events with custom topics');
    console.log('\n🧪 Perfect for testing with Anvil, Hardhat, or Ganache!');
}

// Run demonstration
demonstrateTestingMethods().catch(console.error);
