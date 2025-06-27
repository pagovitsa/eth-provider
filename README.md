# High-Performance IPC Ethereum Provider v2.0

A highly optimized, modular IPC Ethereum provider with advanced performance features and comprehensive monitoring capabilities.

## 🚀 Performance Improvements (v2.0)

This refactored version delivers significant performance improvements through:

- **Modular Architecture**: Split into focused, optimized components
- **Advanced Memory Management**: Object pooling and efficient buffer operations
- **Intelligent Caching**: LRU cache with TTL and automatic cleanup
- **Optimized JSON Parsing**: Fast boundary detection with streaming support
- **Smart Batch Processing**: Priority-based batching with deduplication
- **Comprehensive Metrics**: Detailed performance monitoring and profiling

## 📦 Installation

```bash
npm install @bcoders.gr/eth-provider
```

## 🔧 Quick Start

```javascript
import { IPCProvider } from '@bcoders.gr/eth-provider';

const provider = new IPCProvider('/path/to/geth.ipc', {
  // Performance options
  cacheEnabled: true,
  batchRequests: true,
  poolSize: 100,
  
  // Cache configuration
  cacheSize: 1000,
  cacheTTL: 5000,
  
  // Batch configuration
  batchSize: 10,
  batchTimeout: 10,
  
  // Connection options
  requestTimeout: 30000,
  autoReconnect: true,
  maxRetries: 3
});

await provider.connect();

// Use standard Ethereum JSON-RPC methods
const balance = await provider.getBalance('0x...');
const blockNumber = await provider.getBlockNumber();
const receipt = await provider.getTransactionReceipt('0x...');

// Get performance statistics
const stats = provider.getStats();
provider.printStats();

await provider.disconnect();
```

## 🏗️ Modular Architecture

### Core Components

- **ConnectionManager**: Optimized IPC connection handling with auto-reconnection
- **CacheManager**: High-performance LRU cache with TTL support
- **JSONParser**: Fast streaming JSON parser with boundary detection
- **BatchProcessor**: Intelligent request batching with priority queues
- **MetricsManager**: Comprehensive performance monitoring
- **RequestPool**: Memory-efficient object pooling

### Individual Component Usage

```javascript
import { 
  ConnectionManager, 
  CacheManager, 
  JSONParser,
  BatchProcessor,
  MetricsManager,
  RequestPool 
} from '@bcoders.gr/provider';

// Use components individually for custom implementations
const cache = new CacheManager({ maxSize: 500, defaultTTL: 3000 });
const metrics = new MetricsManager({ enabled: true });
```

## ⚡ Performance Features

### 1. Object Pooling
Reduces garbage collection overhead by reusing request objects:

```javascript
const provider = new IPCProvider(ipcPath, {
  poolSize: 100,        // Initial pool size
  maxPoolSize: 500      // Maximum pool growth
});
```

### 2. Intelligent Caching
Caches read-only method responses with automatic expiration:

```javascript
const provider = new IPCProvider(ipcPath, {
  cacheEnabled: true,
  cacheSize: 1000,      // Max cached items
  cacheTTL: 5000        // Cache TTL in ms
});
```

### 3. Batch Processing
Groups requests for better throughput:

```javascript
const provider = new IPCProvider(ipcPath, {
  batchRequests: true,
  batchSize: 10,        // Requests per batch
  batchTimeout: 10      // Max wait time (ms)
});
```

### 4. Advanced Metrics
Comprehensive performance monitoring:

```javascript
const stats = provider.getStats();
console.log(stats.metrics.derived.requestsPerSecond);
console.log(stats.cache.hitRatio);
console.log(stats.pool.efficiency);

// Print detailed summary
provider.printStats();
```

## 📊 Performance Benchmarks

Run the included benchmarks to see performance improvements:

```bash
npm run benchmark
```

Expected improvements over v1.x:
- **Object Pooling**: 30-50% reduction in allocation overhead
- **JSON Parsing**: 40-60% faster for newline-separated responses
- **Caching**: 80-95% faster for repeated read-only calls
- **Memory Usage**: 20-40% reduction in heap usage

## 🔧 Configuration Options

```javascript
const provider = new IPCProvider(ipcPath, {
  // Connection settings
  requestTimeout: 30000,
  autoReconnect: true,
  maxRetries: 3,
  retryDelay: 1000,
  maxRetryDelay: 10000,
  backoffMultiplier: 2,
  
  // Performance settings
  bufferSize: 2 * 1024 * 1024,  // 2MB buffer
  poolSize: 100,
  maxPoolSize: 500,
  
  // Cache settings
  cacheEnabled: true,
  cacheSize: 1000,
  cacheTTL: 5000,
  
  // Batch settings
  batchRequests: true,
  batchSize: 10,
  batchTimeout: 10,
  deduplicationEnabled: true,
  
  // Metrics settings
  metricsEnabled: true,
  trackResponseTimes: true,
  trackMemoryUsage: true,
  
  // Logging
  logger: console
});
```

## 📈 Monitoring & Metrics

### Real-time Statistics

```javascript
const stats = provider.getStats();

// Connection metrics
console.log(stats.connection.connected);
console.log(stats.metrics.connection.uptime);

// Performance metrics
console.log(stats.metrics.derived.requestsPerSecond);
console.log(stats.metrics.derived.successRate);
console.log(stats.metrics.responses.avgTime);

// Cache performance
console.log(stats.cache.hitRatio);
console.log(stats.cache.size);

// Memory usage
console.log(stats.pool.totalPoolSize);
console.log(stats.parser.bufferSize);
```

### Method-specific Metrics

```javascript
const metrics = provider.getStats().metrics;

// Top methods by usage
const topMethods = metrics.methods;
console.log(topMethods['eth_blockNumber']);

// Recent errors
console.log(metrics.recentErrors);
```

## 🛠️ Advanced Usage

### Custom Component Configuration

```javascript
// Advanced cache configuration
const provider = new IPCProvider(ipcPath, {
  cacheEnabled: true,
  cacheSize: 2000,
  cacheTTL: 10000,
  cleanupInterval: 60000  // Cache cleanup frequency
});

// Advanced batch configuration
const provider = new IPCProvider(ipcPath, {
  batchRequests: true,
  batchSize: 20,
  batchTimeout: 5,
  maxConcurrentBatches: 10,
  deduplicationEnabled: true
});
```

### Health Monitoring

```javascript
// Check provider health
const health = await provider.healthCheck();
console.log(health.status);      // 'healthy' or 'unhealthy'
console.log(health.latency);     // Response latency
console.log(health.connected);   // Connection status
```

## 🔄 Migration from v1.x

The v2.0 API is largely backward compatible:

```javascript
// v1.x code continues to work
const provider = new IPCProvider('/path/to/geth.ipc');
await provider.connect();
const balance = await provider.getBalance('0x...');

// v2.0 adds new capabilities
const stats = provider.getStats();  // New in v2.0
provider.printStats();              // New in v2.0
```

## 🧪 Testing

```bash
# Validate all modules
npm run check

# Run performance benchmarks
npm run benchmark

# Full validation
npm run validate
```

## 📝 API Reference

### Core Methods

- `connect()` - Connect to IPC endpoint
- `disconnect()` - Disconnect and cleanup
- `request(method, params)` - Make JSON-RPC request
- `getStats()` - Get comprehensive statistics
- `printStats()` - Print performance summary

### Ethereum Methods

- `getBalance(address, blockTag)`
- `getBlockNumber()`
- `getGasPrice()`
- `getTransactionCount(address, blockTag)`
- `sendTransaction(txObject)`
- `sendRawTransaction(signedTx)`
- `getTransactionReceipt(txHash)`
- `call(to, data, blockTag)`
- `estimateGas(txObject)`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and benchmarks
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/pagovitsa/provider)
- [NPM Package](https://www.npmjs.com/package/@bcoders.gr/provider)
- [Issues](https://github.com/pagovitsa/provider/issues)

---

**Performance-optimized for production Ethereum applications** 🚀
