import { IPCProvider } from '@bcoders/provider';

async function example() {
    // Create provider instance with options
    const provider = new IPCProvider('/tmp/geth.ipc', {
        cacheEnabled: true,
        cacheTTL: 10000,
        batchRequests: true,
        batchSize: 5,
        autoReconnect: true,
        logResponseTime: true,
        autoDisconnectEnabled: true,
        autoDisconnectTimeout: 2 * 60 * 1000 // 2 minutes for demo
    });

    try {
        // Connect to IPC
        console.log('Connecting to IPC...');
        await provider.connect();
        console.log('✅ Connected successfully!');

        // Get basic blockchain info
        console.log('\n📊 Getting blockchain info...');
        const blockNumber = await provider.getBlockNumber();
        console.log(`Current block: ${blockNumber}`);

        const gasPrice = await provider.getGasPrice();
        console.log(`Gas price: ${gasPrice} wei`);

        // Example balance check
        const balance = await provider.getBalance('0x0000000000000000000000000000000000000000');
        console.log(`Balance: ${balance} wei`);

        // Health check
        console.log('\n🏥 Health check...');
        const health = await provider.healthCheck();
        console.log('Health status:', health.status);
        console.log('Latency:', health.latency, 'ms');

        // Print performance metrics
        console.log('\n📈 Performance metrics:');
        provider.printMetricsSummary();

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        // Always disconnect when done
        console.log('\n🔌 Disconnecting...');
        await provider.disconnect();
        console.log('✅ Disconnected successfully!');
    }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    example().catch(console.error);
}

export default example;
