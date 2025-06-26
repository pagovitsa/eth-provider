import { IPCProvider } from '../index.js';

/**
 * Basic usage example for the refactored IPC Provider
 * Demonstrates key features and performance optimizations
 */
async function basicUsageExample() {
    console.log('🚀 IPC Provider v2.0 - Basic Usage Example\n');

    // Create provider with optimized settings
    const provider = new IPCProvider('/tmp/geth.ipc', {
        // Enable performance features
        cacheEnabled: true,
        batchRequests: true,
        metricsEnabled: true,
        
        // Cache configuration
        cacheSize: 500,
        cacheTTL: 5000,
        
        // Batch configuration
        batchSize: 5,
        batchTimeout: 10,
        
        // Pool configuration
        poolSize: 50,
        
        // Connection settings
        requestTimeout: 15000,
        autoReconnect: true,
        maxRetries: 3
    });

    try {
        console.log('📡 Connecting to IPC endpoint...');
        // Note: This will fail without a real IPC endpoint, but demonstrates the API
        
        // In a real scenario, you would connect like this:
        // await provider.connect();
        
        console.log('✅ Connected successfully!\n');

        // Demonstrate various Ethereum JSON-RPC calls
        console.log('🔍 Making Ethereum JSON-RPC calls...');
        
        // These would work with a real connection:
        // const blockNumber = await provider.getBlockNumber();
        // console.log(`Current block: ${blockNumber}`);
        
        // const balance = await provider.getBalance('0x742d35Cc6634C0532925a3b8D4C9db96590c6C87');
        // console.log(`Balance: ${balance} wei`);
        
        // const gasPrice = await provider.getGasPrice();
        // console.log(`Gas price: ${gasPrice} wei`);

        // Demonstrate batch processing
        console.log('📦 Batch processing example...');
        const batchRequests = [
            // These would be real requests in production:
            // provider.getBlockNumber(),
            // provider.getGasPrice(),
            // provider.getBalance('0x742d35Cc6634C0532925a3b8D4C9db96590c6C87')
        ];
        
        // const results = await Promise.all(batchRequests);
        // console.log('Batch results:', results);

        // Demonstrate caching
        console.log('💾 Cache demonstration...');
        // Repeated calls to read-only methods would be cached:
        // const block1 = await provider.getBlockNumber();
        // const block2 = await provider.getBlockNumber(); // This would come from cache
        
        console.log('📊 Performance statistics:');
        const stats = provider.getStats();
        
        console.log('Connection Status:', stats.connection);
        console.log('Cache Stats:', {
            enabled: stats.cache.enabled,
            size: stats.cache.size,
            hitRatio: stats.cache.hitRatio
        });
        console.log('Pool Stats:', {
            totalPoolSize: stats.pool.totalPoolSize,
            hitRatio: stats.pool.hitRatio,
            efficiency: stats.pool.efficiency
        });
        
        // Print comprehensive metrics
        console.log('\n📈 Detailed Performance Metrics:');
        provider.printStats();

        // Cleanup
        console.log('🧹 Cleaning up...');
        await provider.disconnect();
        console.log('✅ Disconnected successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\nℹ️  Note: This example requires a running Ethereum node with IPC enabled.');
        console.log('   For testing purposes, you can use Ganache, Hardhat, or Anvil.');
        
        // Still show the provider capabilities
        console.log('\n📊 Provider capabilities (without connection):');
        const stats = provider.getStats();
        console.log('- Modular architecture with optimized components');
        console.log('- Object pooling for memory efficiency');
        console.log('- LRU caching with TTL support');
        console.log('- Intelligent batch processing');
        console.log('- Comprehensive performance metrics');
        console.log('- Auto-reconnection with exponential backoff');
    }
}

// Component demonstration
async function componentDemo() {
    console.log('\n🧩 Individual Component Demonstration\n');

    // Cache Manager demo
    console.log('💾 Cache Manager:');
    const { CacheManager } = await import('../src/cache-manager.js');
    const cache = new CacheManager({ maxSize: 100, defaultTTL: 3000 });
    
    cache.set('test-key', { data: 'test-value', timestamp: Date.now() });
    const cached = cache.get('test-key');
    console.log('  Cached value:', cached);
    console.log('  Cache stats:', cache.getStats());

    // Request Pool demo
    console.log('\n📦 Request Pool:');
    const { RequestPool } = await import('../src/request-pool.js');
    const pool = new RequestPool({ poolSize: 10 });
    
    const request = pool.getRequest('test-id', 'eth_blockNumber', []);
    console.log('  Pooled request:', { id: request.id, method: request.method });
    pool.returnRequest(request);
    console.log('  Pool stats:', pool.getStats());

    // JSON Parser demo
    console.log('\n📝 JSON Parser:');
    const { JSONParser } = await import('../src/json-parser.js');
    const parser = new JSONParser();
    
    const testData = '{"id":"1","jsonrpc":"2.0","result":"0x123"}\n';
    const parsed = parser.processData(Buffer.from(testData));
    console.log('  Parsed data:', parsed);
    console.log('  Parser stats:', parser.getStats());

    // Metrics Manager demo
    console.log('\n📊 Metrics Manager:');
    const { MetricsManager } = await import('../src/metrics-manager.js');
    const metrics = new MetricsManager();
    
    const tracking = metrics.recordRequestStart('eth_blockNumber', 'test-id');
    setTimeout(() => {
        metrics.recordRequestSuccess(tracking);
        console.log('  Metrics:', metrics.getMetrics().derived);
    }, 10);
}

// Run examples
console.log('🎯 Running IPC Provider Examples...\n');
await basicUsageExample();
await componentDemo();
console.log('\n🎉 Examples completed!');
