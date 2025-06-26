import { IPCProvider } from '../index.js';

/**
 * Comprehensive demonstration of all EVM methods
 * This example shows how to use the complete Ethereum JSON-RPC API
 */
async function demonstrateEVMMethods() {
    console.log('🚀 EVM Methods Demonstration\n');
    console.log('============================\n');

    // Initialize provider (will work with any Ethereum client)
    const provider = new IPCProvider('/tmp/demo.ipc', {
        cacheEnabled: true,
        batchRequests: true,
        metricsEnabled: true
    });

    try {
        console.log('📋 ACCOUNT METHODS');
        console.log('==================');
        
        // Account methods examples
        console.log('// Get account balance');
        console.log('const balance = await provider.getBalance("0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8");');
        console.log('console.log(`Balance: ${provider.fromWei(balance)} ETH`);\n');

        console.log('// Get transaction count (nonce)');
        console.log('const nonce = await provider.getTransactionCount("0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8");');
        console.log('console.log(`Nonce: ${nonce}`);\n');

        console.log('// Get contract code');
        console.log('const code = await provider.getCode("0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C");');
        console.log('console.log(`Contract code: ${code}`);\n');

        console.log('// Get storage at specific position');
        console.log('const storage = await provider.getStorageAt("0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C", "0x0");');
        console.log('console.log(`Storage: ${storage}`);\n');

        console.log('📋 BLOCK METHODS');
        console.log('================');
        
        console.log('// Get latest block number');
        console.log('const blockNumber = await provider.getBlockNumber();');
        console.log('console.log(`Latest block: ${blockNumber}`);\n');

        console.log('// Get block by number');
        console.log('const block = await provider.getBlockByNumber("latest", false);');
        console.log('console.log(`Block hash: ${block.hash}`);\n');

        console.log('// Get block transaction count');
        console.log('const txCount = await provider.getBlockTransactionCountByNumber("latest");');
        console.log('console.log(`Transaction count: ${txCount}`);\n');

        console.log('// Get uncle count');
        console.log('const uncleCount = await provider.getUncleCountByBlockNumber("latest");');
        console.log('console.log(`Uncle count: ${uncleCount}`);\n');

        console.log('📋 TRANSACTION METHODS');
        console.log('======================');
        
        console.log('// Send transaction');
        console.log('const txHash = await provider.sendTransaction({');
        console.log('    from: "0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8",');
        console.log('    to: "0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8",');
        console.log('    value: provider.toWei("0.1", "ether"),');
        console.log('    gas: "21000"');
        console.log('});');
        console.log('console.log(`Transaction hash: ${txHash}`);\n');

        console.log('// Get transaction receipt');
        console.log('const receipt = await provider.getTransactionReceipt(txHash);');
        console.log('console.log(`Gas used: ${receipt.gasUsed}`);\n');

        console.log('// Get transaction by hash');
        console.log('const tx = await provider.getTransactionByHash(txHash);');
        console.log('console.log(`Transaction value: ${provider.fromWei(tx.value)} ETH`);\n');

        console.log('📋 GAS AND FEE METHODS');
        console.log('======================');
        
        console.log('// Get current gas price');
        console.log('const gasPrice = await provider.getGasPrice();');
        console.log('console.log(`Gas price: ${provider.fromWei(gasPrice, "gwei")} gwei`);\n');

        console.log('// Estimate gas for transaction');
        console.log('const gasEstimate = await provider.estimateGas({');
        console.log('    from: "0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8",');
        console.log('    to: "0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8",');
        console.log('    value: provider.toWei("0.1", "ether")');
        console.log('});');
        console.log('console.log(`Estimated gas: ${gasEstimate}`);\n');

        console.log('// Get fee history (EIP-1559)');
        console.log('const feeHistory = await provider.feeHistory(4, "latest", [25, 50, 75]);');
        console.log('console.log(`Base fee: ${feeHistory.baseFeePerGas[0]}`);\n');

        console.log('// Get max priority fee per gas');
        console.log('const maxPriorityFee = await provider.maxPriorityFeePerGas();');
        console.log('console.log(`Max priority fee: ${provider.fromWei(maxPriorityFee, "gwei")} gwei`);\n');

        console.log('📋 CONTRACT INTERACTION');
        console.log('=======================');
        
        console.log('// Call contract method (read-only)');
        console.log('const result = await provider.call({');
        console.log('    to: "0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C",');
        console.log('    data: "0x70a08231000000000000000000000000742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8"');
        console.log('});');
        console.log('console.log(`Call result: ${result}`);\n');

        console.log('// Create access list');
        console.log('const accessList = await provider.createAccessList({');
        console.log('    from: "0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8",');
        console.log('    to: "0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C",');
        console.log('    data: "0xa9059cbb000000000000000000000000742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8"');
        console.log('});');
        console.log('console.log(`Access list: ${JSON.stringify(accessList)}`);\n');

        console.log('📋 FILTER AND LOG METHODS');
        console.log('=========================');
        
        console.log('// Create event filter');
        console.log('const filterId = await provider.newFilter({');
        console.log('    fromBlock: "latest",');
        console.log('    toBlock: "latest",');
        console.log('    address: "0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C",');
        console.log('    topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]');
        console.log('});');
        console.log('console.log(`Filter ID: ${filterId}`);\n');

        console.log('// Get filter changes');
        console.log('const changes = await provider.getFilterChanges(filterId);');
        console.log('console.log(`Filter changes: ${changes.length} events`);\n');

        console.log('// Get logs');
        console.log('const logs = await provider.getLogs({');
        console.log('    fromBlock: "latest",');
        console.log('    toBlock: "latest",');
        console.log('    address: "0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C"');
        console.log('});');
        console.log('console.log(`Found ${logs.length} logs`);\n');

        console.log('📋 NETWORK AND NODE METHODS');
        console.log('===========================');
        
        console.log('// Get chain ID');
        console.log('const chainId = await provider.chainId();');
        console.log('console.log(`Chain ID: ${chainId}`);\n');

        console.log('// Get network version');
        console.log('const netVersion = await provider.netVersion();');
        console.log('console.log(`Network version: ${netVersion}`);\n');

        console.log('// Check if node is listening');
        console.log('const listening = await provider.netListening();');
        console.log('console.log(`Node listening: ${listening}`);\n');

        console.log('// Get peer count');
        console.log('const peerCount = await provider.netPeerCount();');
        console.log('console.log(`Peer count: ${peerCount}`);\n');

        console.log('// Get sync status');
        console.log('const syncing = await provider.syncing();');
        console.log('console.log(`Syncing: ${syncing}`);\n');

        console.log('📋 UTILITY METHODS');
        console.log('==================');
        
        console.log('// Convert values');
        console.log('const weiValue = provider.toWei("1", "ether");');
        console.log('console.log(`1 ETH = ${weiValue} wei`);\n');

        console.log('const etherValue = provider.fromWei("1000000000000000000", "ether");');
        console.log('console.log(`1000000000000000000 wei = ${etherValue} ETH`);\n');

        console.log('const hexValue = provider.toHex(255);');
        console.log('console.log(`255 = ${hexValue}`);\n');

        console.log('const decValue = provider.fromHex("0xff");');
        console.log('console.log(`0xff = ${decValue}`);\n');

        console.log('📋 BATCH REQUESTS');
        console.log('=================');
        
        console.log('// Execute multiple requests in batch');
        console.log('const batchResults = await provider.batchRequest([');
        console.log('    { method: "eth_blockNumber", params: [] },');
        console.log('    { method: "eth_gasPrice", params: [] },');
        console.log('    { method: "net_version", params: [] }');
        console.log(']);');
        console.log('console.log(`Batch results: ${JSON.stringify(batchResults)}`);\n');

        console.log('📋 DEBUG METHODS (if supported)');
        console.log('===============================');
        
        console.log('// Trace transaction');
        console.log('const trace = await provider.debugTraceTransaction(txHash, {');
        console.log('    tracer: "callTracer"');
        console.log('});');
        console.log('console.log(`Trace: ${JSON.stringify(trace)}`);\n');

        console.log('// Trace call');
        console.log('const callTrace = await provider.debugTraceCall({');
        console.log('    from: "0x742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8",');
        console.log('    to: "0xA0b86a33E6417c8C4C8C8C8C8C8C8C8C8C8C8C8C",');
        console.log('    data: "0x70a08231000000000000000000000000742d35Cc6634C0532925a3b8D400E4C0C0C8C8C8"');
        console.log('}, "latest", { tracer: "callTracer" });');
        console.log('console.log(`Call trace: ${JSON.stringify(callTrace)}`);\n');

        console.log('📊 PERFORMANCE STATISTICS');
        console.log('=========================');
        
        // Show provider statistics
        const stats = provider.getStats();
        console.log('Provider Statistics:');
        console.log(`- Cache hit ratio: ${stats.cache.hitRatio}%`);
        console.log(`- Total requests: ${stats.metrics.requests.total}`);
        console.log(`- Average response time: ${stats.metrics.performance.avgResponseTime}ms`);
        console.log(`- Pool efficiency: ${stats.pool.hitRatio}%`);
        console.log(`- Memory usage: ${(stats.cache.memoryUsage.totalBytes / 1024).toFixed(2)} KB`);

    } catch (error) {
        console.error('❌ Demo error:', error.message);
        console.log('\n💡 Note: This demo shows example usage. Actual execution requires a running Ethereum node.');
    }

    console.log('\n✅ EVM Methods demonstration complete!');
    console.log('\n📚 Available Methods Summary:');
    console.log('============================');
    console.log('✅ Account Methods: getBalance, getTransactionCount, getCode, getStorageAt');
    console.log('✅ Block Methods: getBlockNumber, getBlockByNumber, getBlockByHash, etc.');
    console.log('✅ Transaction Methods: sendTransaction, getTransactionReceipt, etc.');
    console.log('✅ Gas & Fee Methods: getGasPrice, estimateGas, feeHistory, etc.');
    console.log('✅ Contract Methods: call, createAccessList');
    console.log('✅ Filter & Log Methods: newFilter, getLogs, getFilterChanges, etc.');
    console.log('✅ Network Methods: chainId, netVersion, syncing, etc.');
    console.log('✅ Debug Methods: debugTraceTransaction, debugTraceCall, etc.');
    console.log('✅ Utility Methods: toWei, fromWei, toHex, fromHex, batchRequest');
    console.log('\n🚀 Total: 50+ Ethereum JSON-RPC methods supported!');
}

// Run demonstration
demonstrateEVMMethods().catch(console.error);
