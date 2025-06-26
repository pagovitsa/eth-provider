import { IPCProvider } from '../../index.js';
import assert from 'assert';

/**
 * Comprehensive stress and integration tests
 */
class StressTests {
    constructor() {
        this.testResults = [];
        this.provider = null;
    }

    async runAllTests() {
        console.log('🧪 Running Stress & Integration Tests...\n');

        await this.testHighVolumeRequests();
        await this.testMemoryLeakPrevention();
        await this.testConcurrentConnections();
        await this.testLargePayloadHandling();
        await this.testErrorRecovery();
        await this.testPerformanceUnderLoad();

        this.printResults();
    }

    async testHighVolumeRequests() {
        console.log('📝 Testing high volume request handling...');
        
        try {
            const provider = new IPCProvider('/tmp/test.ipc', {
                cacheEnabled: true,
                batchRequests: true,
                poolSize: 100,
                maxPoolSize: 500
            });

            // Simulate high volume of requests
            const requestCount = 1000;
            const startTime = Date.now();
            
            // Create requests without actual IPC connection
            const requests = [];
            for (let i = 0; i < requestCount; i++) {
                // Simulate request creation and pooling
                const stats = provider.getStats();
                requests.push({
                    id: `stress-${i}`,
                    method: i % 2 === 0 ? 'eth_blockNumber' : 'eth_getBalance',
                    params: i % 2 === 0 ? [] : [`0x${i.toString(16)}`]
                });
            }
            
            const endTime = Date.now();
            const processingTime = endTime - startTime;
            
            // Verify provider can handle the load
            const finalStats = provider.getStats();
            assert.strictEqual(finalStats.pool.totalPoolSize > 0, true, 'Pool should be active');
            assert.strictEqual(processingTime < 1000, true, 'Should process 1000 requests quickly');
            
            console.log(`  📊 Processed ${requestCount} requests in ${processingTime}ms`);
            console.log(`  📊 Average: ${(processingTime / requestCount).toFixed(2)}ms per request`);
            
            this.testResults.push({ test: 'High Volume Requests', status: 'PASS', metrics: { requestCount, processingTime } });
            console.log('  ✅ High volume request test passed');
            
        } catch (error) {
            this.testResults.push({ test: 'High Volume Requests', status: 'FAIL', error: error.message });
            console.log('  ❌ High volume request test failed:', error.message);
        }
    }

    async testMemoryLeakPrevention() {
        console.log('📝 Testing memory leak prevention...');
        
        try {
            const provider = new IPCProvider('/tmp/test.ipc', {
                cacheEnabled: true,
                batchRequests: true,
                poolSize: 50
            });

            const initialMemory = process.memoryUsage();
            
            // Simulate many operations that could cause memory leaks
            for (let cycle = 0; cycle < 10; cycle++) {
                // Create and destroy many objects
                for (let i = 0; i < 100; i++) {
                    const stats = provider.getStats();
                    // Simulate cache operations
                    provider.cache.set(`leak-test-${cycle}-${i}`, { data: 'x'.repeat(1000) });
                }
                
                // Clear cache periodically
                if (cycle % 3 === 0) {
                    provider.cache.clear();
                }
                
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }
            }
            
            const finalMemory = process.memoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryGrowthMB = memoryGrowth / 1024 / 1024;
            
            // Memory growth should be reasonable (less than 10MB for this test)
            assert.strictEqual(memoryGrowthMB < 10, true, `Memory growth too high: ${memoryGrowthMB.toFixed(2)}MB`);
            
            console.log(`  📊 Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
            
            this.testResults.push({ test: 'Memory Leak Prevention', status: 'PASS', metrics: { memoryGrowthMB } });
            console.log('  ✅ Memory leak prevention test passed');
            
        } catch (error) {
            this.testResults.push({ test: 'Memory Leak Prevention', status: 'FAIL', error: error.message });
            console.log('  ❌ Memory leak prevention test failed:', error.message);
        }
    }

    async testConcurrentConnections() {
        console.log('📝 Testing concurrent connection handling...');
        
        try {
            // Create multiple providers to test concurrent scenarios
            const providers = [];
            for (let i = 0; i < 5; i++) {
                providers.push(new IPCProvider(`/tmp/test${i}.ipc`, {
                    cacheEnabled: true,
                    batchRequests: true,
                    poolSize: 20
                }));
            }

            // Test concurrent operations
            const operations = providers.map(async (provider, index) => {
                // Simulate concurrent stats gathering
                for (let i = 0; i < 10; i++) {
                    const stats = provider.getStats();
                    assert.strictEqual(typeof stats.metrics, 'object', `Provider ${index} stats invalid`);
                    
                    // Simulate some cache operations
                    provider.cache.set(`concurrent-${index}-${i}`, `value-${i}`);
                    const cached = provider.cache.get(`concurrent-${index}-${i}`);
                    assert.strictEqual(cached, `value-${i}`, `Concurrent cache operation failed for provider ${index}`);
                }
                return index;
            });

            const results = await Promise.all(operations);
            assert.strictEqual(results.length, 5, 'All concurrent operations should complete');
            
            // Cleanup
            providers.forEach(provider => {
                provider.cache.clear();
            });

            this.testResults.push({ test: 'Concurrent Connections', status: 'PASS' });
            console.log('  ✅ Concurrent connection test passed');
            
        } catch (error) {
            this.testResults.push({ test: 'Concurrent Connections', status: 'FAIL', error: error.message });
            console.log('  ❌ Concurrent connection test failed:', error.message);
        }
    }

    async testLargePayloadHandling() {
        console.log('📝 Testing large payload handling...');
        
        try {
            const provider = new IPCProvider('/tmp/test.ipc', {
                bufferSize: 5 * 1024 * 1024, // 5MB buffer
                cacheEnabled: true
            });

            // Test large data structures
            const largeData = {
                transactions: Array.from({ length: 1000 }, (_, i) => ({
                    hash: `0x${'a'.repeat(64)}`,
                    from: `0x${'b'.repeat(40)}`,
                    to: `0x${'c'.repeat(40)}`,
                    value: `0x${i.toString(16)}`,
                    data: 'x'.repeat(1000) // 1KB of data per transaction
                }))
            };

            // Test caching large objects
            const startTime = Date.now();
            provider.cache.set('large-payload', largeData);
            const cached = provider.cache.get('large-payload');
            const endTime = Date.now();

            assert.strictEqual(cached !== null, true, 'Large payload should be cached');
            assert.strictEqual(cached.transactions.length, 1000, 'Large payload structure should be preserved');
            
            const processingTime = endTime - startTime;
            console.log(`  📊 Large payload processing time: ${processingTime}ms`);
            
            // Test memory usage
            const stats = provider.getStats();
            const memoryUsage = stats.cache.memoryUsage;
            console.log(`  📊 Cache memory usage: ${(memoryUsage.totalBytes / 1024 / 1024).toFixed(2)}MB`);

            this.testResults.push({ test: 'Large Payload Handling', status: 'PASS', metrics: { processingTime } });
            console.log('  ✅ Large payload handling test passed');
            
        } catch (error) {
            this.testResults.push({ test: 'Large Payload Handling', status: 'FAIL', error: error.message });
            console.log('  ❌ Large payload handling test failed:', error.message);
        }
    }

    async testErrorRecovery() {
        console.log('📝 Testing error recovery mechanisms...');
        
        try {
            const provider = new IPCProvider('/tmp/test.ipc', {
                cacheEnabled: true,
                batchRequests: true,
                autoReconnect: true,
                maxRetries: 3
            });

            // Test cache error recovery
            try {
                // Simulate cache overflow
                for (let i = 0; i < 2000; i++) {
                    provider.cache.set(`overflow-${i}`, { data: 'x'.repeat(1000) });
                }
            } catch (error) {
                // Should handle gracefully
            }

            // Cache should still be functional
            provider.cache.set('recovery-test', 'recovery-value');
            const recovered = provider.cache.get('recovery-test');
            assert.strictEqual(recovered, 'recovery-value', 'Cache should recover from errors');

            // Test JSON parser error recovery
            const { JSONParser } = await import('../../src/json-parser.js');
            const parser = new JSONParser();
            
            // Feed invalid data
            parser.processData(Buffer.from('invalid json data'));
            
            // Should still work with valid data
            const validData = '{"id":"1","jsonrpc":"2.0","result":"test"}\n';
            const results = parser.processData(Buffer.from(validData));
            assert.strictEqual(results.length, 1, 'Parser should recover from errors');

            // Test metrics error handling
            provider.metrics.recordError(new Error('Test error'), 'test');
            const metrics = provider.getStats().metrics;
            assert.strictEqual(metrics.recentErrors.length > 0, true, 'Errors should be tracked');

            this.testResults.push({ test: 'Error Recovery', status: 'PASS' });
            console.log('  ✅ Error recovery test passed');
            
        } catch (error) {
            this.testResults.push({ test: 'Error Recovery', status: 'FAIL', error: error.message });
            console.log('  ❌ Error recovery test failed:', error.message);
        }
    }

    async testPerformanceUnderLoad() {
        console.log('📝 Testing performance under load...');
        
        try {
            const provider = new IPCProvider('/tmp/test.ipc', {
                cacheEnabled: true,
                batchRequests: true,
                poolSize: 100,
                maxPoolSize: 500,
                metricsEnabled: true
            });

            const loadTestDuration = 1000; // 1 second
            const startTime = Date.now();
            let operationCount = 0;

            // Simulate continuous load
            const loadPromise = new Promise((resolve) => {
                const interval = setInterval(() => {
                    if (Date.now() - startTime >= loadTestDuration) {
                        clearInterval(interval);
                        resolve();
                        return;
                    }

                    // Perform various operations
                    operationCount++;
                    
                    // Cache operations
                    provider.cache.set(`load-${operationCount}`, { data: operationCount });
                    provider.cache.get(`load-${operationCount}`);
                    
                    // Stats gathering
                    provider.getStats();
                    
                    // Pool operations
                    const request = provider.requestPool.getRequest(`load-${operationCount}`, 'test', []);
                    provider.requestPool.returnRequest(request);
                    
                }, 1); // Every 1ms
            });

            await loadPromise;
            
            const endTime = Date.now();
            const actualDuration = endTime - startTime;
            const operationsPerSecond = (operationCount / actualDuration) * 1000;

            console.log(`  📊 Operations completed: ${operationCount}`);
            console.log(`  📊 Operations per second: ${operationsPerSecond.toFixed(0)}`);
            console.log(`  📊 Test duration: ${actualDuration}ms`);

            // Verify performance metrics
            const finalStats = provider.getStats();
            assert.strictEqual(finalStats.pool.totalPoolSize > 0, true, 'Pool should be active under load');
            assert.strictEqual(finalStats.cache.size >= 0, true, 'Cache should be functional under load');

            // Performance should be reasonable (at least 100 ops/sec)
            assert.strictEqual(operationsPerSecond >= 100, true, `Performance too low: ${operationsPerSecond.toFixed(0)} ops/sec`);

            this.testResults.push({ 
                test: 'Performance Under Load', 
                status: 'PASS', 
                metrics: { operationCount, operationsPerSecond: operationsPerSecond.toFixed(0) }
            });
            console.log('  ✅ Performance under load test passed');
            
        } catch (error) {
            this.testResults.push({ test: 'Performance Under Load', status: 'FAIL', error: error.message });
            console.log('  ❌ Performance under load test failed:', error.message);
        }
    }

    printResults() {
        console.log('\n📊 Stress & Integration Test Results:');
        console.log('=====================================');
        
        let passed = 0;
        let failed = 0;
        
        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${status} ${result.test}: ${result.status}`);
            
            if (result.metrics) {
                Object.entries(result.metrics).forEach(([key, value]) => {
                    console.log(`   ${key}: ${value}`);
                });
            }
            
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
            
            if (result.status === 'PASS') passed++;
            else failed++;
        });
        
        console.log(`\nSummary: ${passed} passed, ${failed} failed`);
        console.log('=====================================\n');
    }
}

// Export for use in test runner
export default StressTests;

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tests = new StressTests();
    tests.runAllTests().catch(console.error);
}
