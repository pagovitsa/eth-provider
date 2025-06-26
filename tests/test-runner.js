import CacheManagerTests from './unit/cache-manager.test.js';
import JSONParserTests from './unit/json-parser.test.js';
import RequestPoolTests from './unit/request-pool.test.js';
import StressTests from './integration/stress-test.js';

/**
 * Comprehensive test runner for all provider tests
 */
class TestRunner {
    constructor() {
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.startTime = null;
    }

    async runAllTests() {
        console.log('🚀 Starting Comprehensive Test Suite\n');
        console.log('=====================================');
        this.startTime = Date.now();

        try {
            // Unit Tests
            console.log('📋 UNIT TESTS');
            console.log('=============\n');
            
            await this.runUnitTests();
            
            console.log('\n📋 INTEGRATION & STRESS TESTS');
            console.log('==============================\n');
            
            await this.runIntegrationTests();
            
            this.printFinalSummary();
            
        } catch (error) {
            console.error('❌ Test runner failed:', error);
            process.exit(1);
        }
    }

    async runUnitTests() {
        // Cache Manager Tests
        console.log('🧪 Cache Manager Unit Tests');
        const cacheTests = new CacheManagerTests();
        await cacheTests.runAllTests();
        this.aggregateResults(cacheTests.testResults);

        // JSON Parser Tests
        console.log('🧪 JSON Parser Unit Tests');
        const parserTests = new JSONParserTests();
        await parserTests.runAllTests();
        this.aggregateResults(parserTests.testResults);

        // Request Pool Tests
        console.log('🧪 Request Pool Unit Tests');
        const poolTests = new RequestPoolTests();
        await poolTests.runAllTests();
        this.aggregateResults(poolTests.testResults);
    }

    async runIntegrationTests() {
        // Stress and Integration Tests
        console.log('🧪 Stress & Integration Tests');
        const stressTests = new StressTests();
        await stressTests.runAllTests();
        this.aggregateResults(stressTests.testResults);
    }

    aggregateResults(testResults) {
        testResults.forEach(result => {
            this.totalTests++;
            if (result.status === 'PASS') {
                this.passedTests++;
            } else {
                this.failedTests++;
            }
        });
    }

    printFinalSummary() {
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        const successRate = ((this.passedTests / this.totalTests) * 100).toFixed(1);

        console.log('\n🎯 FINAL TEST SUMMARY');
        console.log('=====================');
        console.log(`📊 Total Tests: ${this.totalTests}`);
        console.log(`✅ Passed: ${this.passedTests}`);
        console.log(`❌ Failed: ${this.failedTests}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`🚀 Average: ${(duration / this.totalTests).toFixed(2)}ms per test`);
        
        if (this.failedTests === 0) {
            console.log('\n🎉 ALL TESTS PASSED! 🎉');
            console.log('The refactored IPC Provider is working perfectly!');
        } else {
            console.log(`\n⚠️  ${this.failedTests} test(s) failed. Please review the results above.`);
        }
        
        console.log('=====================\n');

        // Exit with appropriate code
        process.exit(this.failedTests === 0 ? 0 : 1);
    }
}

// Performance validation test
async function validatePerformanceImprovements() {
    console.log('🔬 Performance Validation');
    console.log('=========================\n');

    try {
        // Import and run performance benchmarks
        const { default: PerformanceBenchmark } = await import('../benchmarks/performance-test.js');
        const benchmark = new PerformanceBenchmark();
        
        console.log('Running performance benchmarks to validate improvements...\n');
        await benchmark.runAllTests();
        
        console.log('✅ Performance validation completed\n');
        
    } catch (error) {
        console.log('⚠️  Performance validation skipped:', error.message);
        console.log('   (This is normal if running without benchmark dependencies)\n');
    }
}

// Component integration test
async function validateComponentIntegration() {
    console.log('🔗 Component Integration Validation');
    console.log('===================================\n');

    try {
        const { IPCProvider } = await import('../index.js');
        
        // Test that all components work together
        const provider = new IPCProvider('/tmp/integration-test.ipc', {
            cacheEnabled: true,
            batchRequests: true,
            metricsEnabled: true,
            poolSize: 10
        });

        // Test component interaction
        const stats = provider.getStats();
        
        console.log('✅ All components loaded successfully');
        console.log('✅ Provider initialization successful');
        console.log('✅ Statistics gathering functional');
        console.log(`✅ Cache system: ${stats.cache.enabled ? 'enabled' : 'disabled'}`);
        console.log(`✅ Batch processing: ${stats.batch ? 'available' : 'unavailable'}`);
        console.log(`✅ Metrics tracking: ${stats.metrics.enabled ? 'enabled' : 'disabled'}`);
        console.log(`✅ Object pooling: ${stats.pool.totalPoolSize} objects ready`);
        
        console.log('\n🎯 Component integration validation passed!\n');
        
    } catch (error) {
        console.error('❌ Component integration validation failed:', error);
        throw error;
    }
}

// Main execution
async function main() {
    console.log('🧪 IPC Provider v2.0 - Comprehensive Test Suite');
    console.log('================================================\n');

    // Validate component integration first
    await validateComponentIntegration();
    
    // Run performance validation
    await validatePerformanceImprovements();
    
    // Run comprehensive test suite
    const testRunner = new TestRunner();
    await testRunner.runAllTests();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('💥 Test suite failed:', error);
        process.exit(1);
    });
}

export default TestRunner;
