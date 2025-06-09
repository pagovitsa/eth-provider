# @bcoders/provider

High-Performance IPC Ethereum Provider with Advanced Optimizations

## Features

- 🚀 **High Performance**: Optimized buffer handling and JSON parsing
- 🔄 **Auto Reconnection**: Exponential backoff reconnection strategy  
- ⏰ **Auto Disconnect**: Automatically disconnects after inactivity to save resources
- 💾 **Smart Caching**: LRU cache with TTL for read-only methods
- 📦 **Batch Processing**: Request batching for better throughput
- 🔍 **Comprehensive Monitoring**: Detailed metrics and health checks
- 🛡️ **Robust Error Handling**: Graceful error handling and recovery
- 🏊 **Memory Efficient**: Object pooling and buffer management

## Installation

```bash
npm install @bcoders/provider
```

## Usage

```javascript
import { IPCProvider } from '@bcoders/provider';

// Create provider instance
const provider = new IPCProvider('/path/to/geth.ipc', {
  cacheEnabled: true,
  batchRequests: true,
  autoReconnect: true
});

// Connect to IPC
await provider.connect();

// Use Ethereum methods
const balance = await provider.getBalance('0x...');
const blockNumber = await provider.getBlockNumber();
const gasPrice = await provider.getGasPrice();

// NEW: Use specialized methods for log filtering
// Get mint events from a Uniswap V2 pair
const mintLogs = await provider.getMint(
  '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852', // pair address
  18900000, // from block
  'latest'  // to block
);

// Get custom past logs (e.g., Transfer events)
const transferLogs = await provider.getPastLogs(
  '0xa0b86a33e6441b8bb96c0e6a3d8c5b6c7d7e8e9d', // token address
  19000000, // from block
  'latest', // to block
  ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'] // Transfer topic
);

// Convert values to hex format
const hexBlock = provider.toHex(19000000); // '0x1216c20'

// Health check
const health = await provider.healthCheck();
console.log(health);

// Get performance metrics
provider.printMetricsSummary();

// Disconnect when done
await provider.disconnect();
```

## Configuration Options

```javascript
const options = {
  // Performance settings
  requestTimeout: 30000,
  bufferSize: 2 * 1024 * 1024, // 2MB
  poolSize: 100,
  
  // Caching
  cacheEnabled: true,
  cacheTTL: 5000,
  cacheSize: 1000,
  
  // Batching
  batchRequests: false,
  batchSize: 10,
  batchTimeout: 10,
  
  // Connection management
  autoReconnect: true,
  maxRetries: 3,
  retryDelay: 1000,
  maxRetryDelay: 10000,
  backoffMultiplier: 2,
  
  // Auto-disconnect
  autoDisconnectEnabled: true,
  autoDisconnectTimeout: 5 * 60 * 1000, // 5 minutes
  
  // Logging
  logger: console,
  logResponseTime: true
};
```

## Supported Methods

### Standard Ethereum JSON-RPC Methods
- `eth_blockNumber`
- `eth_getBalance`
- `eth_getCode`
- `eth_getTransaction*`
- `eth_getBlock*`
- `eth_sendTransaction`
- `eth_sendRawTransaction`
- `eth_call`
- `eth_estimateGas`
- `eth_gasPrice`
- And many more...

### Development Methods (Anvil/Hardhat)
- `evm_mine`
- `evm_snapshot`
- `evm_revert`
- `anvil_reset`
- `debug_traceTransaction`

### Specialized Methods
- `getMint(address, fromBlock, toBlock)` - Get mint events for a specific contract
- `getPastLogs(address, fromBlock, toBlock, topics)` - Get past logs with custom topics
- `toHex(value)` - Convert numbers to hex format

## Performance Features

- **Buffer Optimization**: Uses native Buffer operations for efficient data handling
- **JSON Parsing**: Optimized JSON boundary detection and parsing
- **Connection Pooling**: Maintains persistent connections with optimized socket settings
- **Request Pooling**: Object pooling for memory efficiency
- **Smart Caching**: Caches read-only method results with LRU eviction
- **Batch Processing**: Groups multiple requests for better throughput

## Monitoring

```javascript
// Get detailed metrics
const metrics = provider.getMetrics();

// Print summary
provider.printMetricsSummary();

// Health check
const health = await provider.healthCheck();
```

## License

MIT

## Author

pagovitsa
