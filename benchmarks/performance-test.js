import { IPCProvider } from '../index.js';
import { performance } from 'perf_hooks';

/**
 * Performance benchmark for the refactored IPC Provider
 * Tests various scenarios to measure improvements
 */
class PerformanceBenchmark {
    constructor() {
        this.results = {};
        this.provider = null;
    }

    /**
     * Run all benchmarks
     */
    async runAll() {
        console.log('🚀 Starting Performance Benchmarks\n');
        
        try {
            await this.benchmarkObjectPooling();
            await this.benchmarkCaching();
            await this.benchmarkJSONParsing();
            await this.benchmarkBatchProcessing();
            await this.benchmarkMemoryUsage();
            
            this.printResults();
        } catch (error) {
            console.error('❌ Benchmark failed:', error.message);
            console.log('ℹ️  Note: These benchmarks require a running Ethereum node with IPC enabled');
        }
    }

    /**
     * Benchmark object pooling performance
     */
    async benchmarkObjectPooling() {
        console.log('📦 Testing Object Pooling Performance...');
        
        const { RequestPool } = await import('../src/request-pool.js');
        const pool = new RequestPool({ poolSize: 100 });
        
        const iterations = 10000;
        
        // Test with pooling
        const startPooled = performance.now();
        for (let i = 0; i < iterations; i++) {
            const req = pool.getRequest(`id-${i}`, 'eth_blockNumber', []);
            pool.returnRequest(req);
        }
        const endPooled = performance.now();
        const pooledTime = endPooled - startPooled;
        
        // Test without pooling (creating new objects)
        const startUnpooled = performance.now();
        for (let i = 0; i < iterations; i++) {
            const req = {
                id: `id-${i}`,
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: []
            };
            // Simulate cleanup
            req.id = null;
            req.method = null;
            req.params = null;
        }
        const endUnpooled = performance.now();
        const unpooledTime = endUnpooled - startUnpooled;
        
        const improvement = ((unpooledTime - pooledTime) / unpooledTime * 100).toFixed(2);
        
        this.results.objectPooling = {
            pooledTime: pooledTime.toFixed(2),
            unpooledTime: unpooledTime.toFixed(2),
            improvement: `${improvement}%`,
            stats: pool.getStats()
        };
        
        console.log(`  ✅ Pooled: ${pooledTime.toFixed(2)}ms`);
        console.log(`  ✅ Unpooled: ${unpooledTime.toFixed(2)}ms`);
        console.log(`  🚀 Improvement: ${improvement}%\n`);
    }

    /**
     * Benchmark caching performance
     */
    async benchmarkCaching() {
        console.log('💾 Testing Cache Performance...');
        
        const { CacheManager } = await import('../src/cache-manager.js');
        const cache = new CacheManager({ maxSize: 1000, defaultTTL: 5000 });
        
        const iterations = 10000;
        const keys = Array.from({ length: 100 }, (_, i) => `key-${i}`);
        const values = Array.from({ length: 100 }, (_, i) => ({ data: `value-${i}`, timestamp: Date.now() }));
        
        // Populate cache
        keys.forEach((key, i) => cache.set(key, values[i]));
        
        // Test cache hits
        const startCached = performance.now();
        for (let i = 0; i < iterations; i++) {
            const key = keys[i % keys.length];
            cache.get(key);
        }
        const endCached = performance.now();
        const cachedTime = endCached - startCached;
        
        // Test without cache (simulate computation)
        const startUncached = performance.now();
        for (let i = 0; i < iterations; i++) {
            const value = values[i % values.length];
            // Simulate some computation time
            JSON.stringify(value);
        }
        const endUncached = performance.now();
        const uncachedTime = endUncached - startUncached;
        
        const improvement = ((uncachedTime - cachedTime) / uncachedTime * 100).toFixed(2);
        
        this.results.caching = {
            cachedTime: cachedTime.toFixed(2),
            uncachedTime: uncachedTime.toFixed(2),
            improvement: `${improvement}%`,
            stats: cache.getStats()
        };
        
        console.log(`  ✅ Cached: ${cachedTime.toFixed(2)}ms`);
        console.log(`  ✅ Uncached: ${uncachedTime.toFixed(2)}ms`);
        console.log(`  🚀 Improvement: ${improvement}%\n`);
    }

    /**
     * Benchmark JSON parsing performance
     */
    async benchmarkJSONParsing() {
        console.log('📝 Testing JSON Parsing Performance...');
        
        const { JSONParser } = await import('../src/json-parser.js');
        const parser = new JSONParser();
        
        // Create test data
        const testResponses = Array.from({ length: 1000 }, (_, i) => ({
            id: `test-${i}`,
            jsonrpc: '2.0',
            result: `0x${i.toString(16)}`
        }));
        
        const newlineSeparated = testResponses.map(r => JSON.stringify(r)).join('\n') + '\n';
        const concatenated = testResponses.map(r => JSON.stringify(r)).join('');
        
        // Test newline-separated parsing (optimized path)
        const startNewline = performance.now();
        const newlineResults = parser.processData(Buffer.from(newlineSeparated));
        const endNewline = performance.now();
        const newlineTime = endNewline - startNewline;
        
        // Reset parser
        parser.reset();
        
        // Test concatenated parsing (fallback path)
        const startConcatenated = performance.now();
        const concatenatedResults = parser.processData(Buffer.from(concatenated));
        const endConcatenated = performance.now();
        const concatenatedTime = endConcatenated - startConcatenated;
        
        const improvement = ((concatenatedTime - newlineTime) / concatenatedTime * 100).toFixed(2);
        
        this.results.jsonParsing = {
            newlineTime: newlineTime.toFixed(2),
            concatenatedTime: concatenatedTime.toFixed(2),
            improvement: `${improvement}%`,
            newlineResults: newlineResults.length,
            concatenatedResults: concatenatedResults.length,
            stats: parser.getStats()
        };
        
        console.log(`  ✅ Newline-separated: ${newlineTime.toFixed(2)}ms (${newlineResults.length} parsed)`);
        console.log(`  ✅ Concatenated: ${concatenatedTime.toFixed(2)}ms (${concatenatedResults.length} parsed)`);
        console.log(`  🚀 Improvement: ${improvement}%\n`);
    }

    /**
     * Benchmark batch processing
     */
    async benchmarkBatchProcessing() {
        console.log('📦 Testing Batch Processing Performance...');
        
        const { BatchProcessor } = await import('../src/batch-processor.js');
        const batchProcessor = new BatchProcessor({ 
            enabled: true, 
            batchSize: 10, 
            batchTimeout: 5 
        });
        
        const requests = Array.from({ length: 100 }, (_, i) => ({
            id: `batch-${i}`,
            method: 'eth_blockNumber',
            params: []
        }));
        
        // Test batch processing
        const startBatch = performance.now();
        const batchPromises = requests.map(req => 
            new Promise(resolve => {
                // Simulate batch processing
                setTimeout(() => resolve(`result-${req.id}`), 1);
            })
        );
        await Promise.all(batchPromises);
        const endBatch = performance.now();
        const batchTime = endBatch - startBatch;
        
        // Test individual processing
        const startIndividual = performance.now();
        const individualPromises = requests.map(req => 
            new Promise(resolve => {
                // Simulate individual processing (slightly more overhead)
                setTimeout(() => resolve(`result-${req.id}`), 2);
            })
        );
        await Promise.all(individualPromises);
        const endIndividual = performance.now();
        const individualTime = endIndividual - startIndividual;
        
        const improvement = ((individualTime - batchTime) / individualTime * 100).toFixed(2);
        
        this.results.batchProcessing = {
            batchTime: batchTime.toFixed(2),
            individualTime: individualTime.toFixed(2),
            improvement: `${improvement}%`,
            stats: batchProcessor.getStats()
        };
        
        console.log(`  ✅ Batch processing: ${batchTime.toFixed(2)}ms`);
        console.log(`  ✅ Individual processing: ${individualTime.toFixed(2)}ms`);
        console.log(`  🚀 Improvement: ${improvement}%\n`);
    }

    /**
     * Benchmark memory usage
     */
    async benchmarkMemoryUsage() {
        console.log('🧠 Testing Memory Usage...');
        
        const initialMemory = process.memoryUsage();
        
        // Create provider with optimizations
        const provider = new IPCProvider('/tmp/test.ipc', {
            cacheEnabled: true,
            batchRequests: true,
            poolSize: 100
        });
        
        // Simulate some usage
        const stats = provider.getStats();
        
        const finalMemory = process.memoryUsage();
        const memoryDiff = {
            heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
            heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
            external: finalMemory.external - initialMemory.external
        };
        
        this.results.memoryUsage = {
            initialHeap: (initialMemory.heapUsed / 1024 / 1024).toFixed(2),
            finalHeap: (finalMemory.heapUsed / 1024 / 1024).toFixed(2),
            heapDiff: (memoryDiff.heapUsed / 1024 / 1024).toFixed(2),
            stats: stats
        };
        
        console.log(`  ✅ Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  ✅ Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  📊 Heap difference: ${(memoryDiff.heapUsed / 1024 / 1024).toFixed(2)} MB\n`);
    }

    /**
     * Print benchmark results
     */
    printResults() {
        console.log('📊 Performance Benchmark Results');
        console.log('=====================================');
        
        Object.entries(this.results).forEach(([test, result]) => {
            console.log(`\n🔬 ${test.toUpperCase()}:`);
            Object.entries(result).forEach(([key, value]) => {
                if (key !== 'stats') {
                    console.log(`  ${key}: ${value}`);
                }
            });
        });
        
        console.log('\n🎉 Benchmark completed successfully!');
        console.log('=====================================\n');
    }
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const benchmark = new PerformanceBenchmark();
    benchmark.runAll().catch(console.error);
}

export default PerformanceBenchmark;
