import { ConnectionManager } from './connection-manager.js';
import { CacheManager } from './cache-manager.js';
import { JSONParser } from './json-parser.js';
import { BatchProcessor } from './batch-processor.js';
import { MetricsManager } from './metrics-manager.js';
import { RequestPool } from './request-pool.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * High-Performance IPC Ethereum Provider with Advanced Optimizations
 * Refactored version with modular architecture and improved performance
 */
export class IPCProvider {
    constructor(ipcPath = '/home/chain/exec/geth.ipc', options = {}) {
        this.ipcPath = ipcPath;
        this.logger = options.logger || console;

        // Initialize core components
        this.connection = new ConnectionManager(ipcPath, {
            ...options,
            logger: this.logger
        });

        this.cache = new CacheManager({
            enabled: options.cacheEnabled !== false,
            maxSize: options.cacheSize || 1000,
            defaultTTL: options.cacheTTL || 5000,
            logger: this.logger
        });

        this.jsonParser = new JSONParser({
            bufferSize: options.bufferSize || 2 * 1024 * 1024,
            logger: this.logger
        });

        this.batchProcessor = new BatchProcessor({
            enabled: options.batchRequests !== false,
            batchSize: options.batchSize || 10,
            batchTimeout: options.batchTimeout || 10,
            logger: this.logger
        });

        this.metrics = new MetricsManager({
            enabled: options.metricsEnabled !== false,
            trackResponseTimes: true,
            trackMemoryUsage: true,
            logger: this.logger
        });

        this.requestPool = new RequestPool({
            poolSize: options.poolSize || 100,
            maxPoolSize: options.maxPoolSize || 500,
            logger: this.logger
        });

        // Request tracking
        this.pendingRequests = new Map();
        this.requestTimeout = options.requestTimeout || 30000;

        // Read-only methods for caching
        this.readOnlyMethods = new Set([
            // Block methods
            'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash',
            'eth_getBlockTransactionCountByNumber', 'eth_getBlockTransactionCountByHash',
            'eth_getUncleCountByBlockNumber', 'eth_getUncleCountByBlockHash',
            'eth_getUncleByBlockNumberAndIndex', 'eth_getUncleByBlockHashAndIndex',
            
            // Account methods
            'eth_getBalance', 'eth_getCode', 'eth_getTransactionCount', 'eth_getStorageAt',
            
            // Transaction methods
            'eth_getTransactionByHash', 'eth_getTransactionReceipt',
            'eth_getTransactionByBlockNumberAndIndex', 'eth_getTransactionByBlockHashAndIndex',
            
            // Gas and fee methods
            'eth_gasPrice', 'eth_feeHistory', 'eth_maxPriorityFeePerGas',
            
            // Contract interaction (read-only)
            'eth_call', 'eth_createAccessList',
            
            // Network and node info
            'eth_chainId', 'net_version', 'net_listening', 'net_peerCount',
            'eth_protocolVersion', 'eth_syncing', 'eth_coinbase', 'eth_mining',
            'eth_hashrate', 'eth_accounts',
            
            // Web3 methods
            'web3_clientVersion', 'web3_sha3'
        ]);

        // Set up event handlers
        this.setupEventHandlers();
    }

    /**
     * Set up event handlers for components
     */
    setupEventHandlers() {
        // Connection events
        this.connection.on('connected', () => {
            this.metrics.recordConnectionEvent('connect');
        });

        this.connection.on('disconnected', () => {
            this.metrics.recordConnectionEvent('disconnect');
        });

        this.connection.on('error', (error) => {
            this.metrics.recordConnectionEvent('error');
            this.logger.error('Connection error:', error);
        });

        this.connection.on('data', (data) => {
            this.handleIncomingData(data);
        });

        // Batch processor events
        this.batchProcessor.on('batchReady', (batch) => {
            this.processBatch(batch);
        });
    }

    /**
     * Handle incoming data from IPC connection
     * @param {Buffer} data - Raw data buffer
     */
    handleIncomingData(data) {
        const responses = this.jsonParser.processData(data);
        
        for (const response of responses) {
            if (response.id && this.pendingRequests.has(response.id)) {
                const { resolve, reject, tracking } = this.pendingRequests.get(response.id);
                this.pendingRequests.delete(response.id);

                if (response.error) {
                    this.metrics.recordRequestFailure(tracking, new Error(response.error.message));
                    reject(new Error(response.error.message));
                } else {
                    this.metrics.recordRequestSuccess(tracking);
                    
                    // Cache successful read-only responses
                    if (tracking.method && this.readOnlyMethods.has(tracking.method)) {
                        const cacheKey = `${tracking.method}:${JSON.stringify(tracking.params)}`;
                        this.cache.set(cacheKey, response.result);
                    }
                    
                    resolve(response.result);
                }
            }
        }
    }

    /**
     * Process a batch of requests
     * @param {object} batch - Batch object containing requests
     */
    async processBatch({ batchId, requests, items }) {
        try {
            const requestJson = JSON.stringify(requests) + '\n';
            this.connection.write(requestJson);
        } catch (error) {
            items.forEach(item => item.reject(error));
            this.logger.error('Batch processing error:', error);
        }
    }

    /**
     * Connect to IPC endpoint
     */
    async connect() {
        await this.connection.connect();
    }

    /**
     * Make an RPC request
     * @param {string} method - RPC method
     * @param {Array} params - Method parameters
     * @returns {Promise} Request promise
     */
    async request(method, params = []) {
        if (!this.connection.isConnected) {
            throw new Error('Not connected to IPC socket');
        }

        // Check cache for read-only methods
        if (this.readOnlyMethods.has(method)) {
            const cacheKey = `${method}:${JSON.stringify(params)}`;
            const cached = this.cache.get(cacheKey);
            if (cached !== null) {
                return cached;
            }
        }

        const id = uuidv4();
        const tracking = this.metrics.recordRequestStart(method, id);
        const request = this.requestPool.getRequest(id, method, params);

        const promise = new Promise((resolve, reject) => {
            // Set up request timeout
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    this.metrics.recordRequestFailure(tracking, new Error('Request timeout'), 'timeout');
                    reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
                }
            }, this.requestTimeout);

            this.pendingRequests.set(id, { resolve, reject, tracking, timeout });

            // Use batch processor if enabled
            if (this.batchProcessor.enabled) {
                this.batchProcessor.addRequest(request).catch(reject);
            } else {
                try {
                    const requestJson = JSON.stringify(request) + '\n';
                    this.connection.write(requestJson);
                } catch (error) {
                    this.pendingRequests.delete(id);
                    clearTimeout(timeout);
                    this.metrics.recordRequestFailure(tracking, error);
                    reject(error);
                }
            }
        });

        // Cleanup after promise settles
        promise.finally(() => {
            this.requestPool.returnRequest(request);
        });

        return promise;
    }

    /**
     * Disconnect from IPC endpoint
     */
    async disconnect() {
        // Process any remaining batches
        if (this.batchProcessor.enabled) {
            this.batchProcessor.clear();
        }

        // Reject all pending requests
        for (const [id, { reject, timeout }] of this.pendingRequests) {
            clearTimeout(timeout);
            reject(new Error('Provider disconnected'));
        }
        this.pendingRequests.clear();

        // Clear cache
        this.cache.clear();

        // Disconnect socket
        await this.connection.disconnect();

        // Final metrics update
        this.updateMetrics();
    }

    /**
     * Update and collect metrics from all components
     */
    updateMetrics() {
        // Update component metrics
        this.metrics.recordCacheMetrics(this.cache.getStats());
        this.metrics.recordBatchMetrics(this.batchProcessor.getStats());
        
        const memoryStats = {
            bufferSize: this.jsonParser.getBufferSize(),
            cacheSize: this.cache.getStats().size,
            poolSize: this.requestPool.getStats().totalPoolSize
        };
        this.metrics.recordMemoryMetrics(memoryStats);
    }

    /**
     * Get comprehensive provider statistics
     */
    getStats() {
        this.updateMetrics();
        return {
            metrics: this.metrics.getMetrics(),
            connection: this.connection.getStatus(),
            cache: this.cache.getStats(),
            parser: this.jsonParser.getStats(),
            batch: this.batchProcessor.getStats(),
            pool: this.requestPool.getStats()
        };
    }

    /**
     * Print performance summary
     */
    printStats() {
        this.metrics.printSummary();
    }

    // ========================================
    // ETHEREUM JSON-RPC METHOD IMPLEMENTATIONS
    // ========================================

    // Account Methods
    async getBalance(address, blockTag = 'latest') {
        const result = await this.request('eth_getBalance', [address, blockTag]);
        return typeof result === 'string' ? BigInt(result).toString() : result;
    }

    async getTransactionCount(address, blockTag = 'latest') {
        const result = await this.request('eth_getTransactionCount', [address, blockTag]);
        return typeof result === 'string' ? parseInt(result, 16) : result;
    }

    async getCode(address, blockTag = 'latest') {
        return await this.request('eth_getCode', [address, blockTag]);
    }

    async getStorageAt(address, position, blockTag = 'latest') {
        return await this.request('eth_getStorageAt', [address, position, blockTag]);
    }

    // Block Methods
    async getBlockNumber() {
        const result = await this.request('eth_blockNumber');
        return typeof result === 'string' ? parseInt(result, 16).toString() : result;
    }

    async getBlockByNumber(blockNumber, fullTransactions = false) {
        const blockTag = typeof blockNumber === 'number' ? this.toHex(blockNumber) : blockNumber;
        return await this.request('eth_getBlockByNumber', [blockTag, fullTransactions]);
    }

    async getBlockByHash(blockHash, fullTransactions = false) {
        return await this.request('eth_getBlockByHash', [blockHash, fullTransactions]);
    }

    async getBlockTransactionCountByNumber(blockNumber) {
        const blockTag = typeof blockNumber === 'number' ? this.toHex(blockNumber) : blockNumber;
        const result = await this.request('eth_getBlockTransactionCountByNumber', [blockTag]);
        return typeof result === 'string' ? parseInt(result, 16) : result;
    }

    async getBlockTransactionCountByHash(blockHash) {
        const result = await this.request('eth_getBlockTransactionCountByHash', [blockHash]);
        return typeof result === 'string' ? parseInt(result, 16) : result;
    }

    async getUncleCountByBlockNumber(blockNumber) {
        const blockTag = typeof blockNumber === 'number' ? this.toHex(blockNumber) : blockNumber;
        const result = await this.request('eth_getUncleCountByBlockNumber', [blockTag]);
        return typeof result === 'string' ? parseInt(result, 16) : result;
    }

    async getUncleCountByBlockHash(blockHash) {
        const result = await this.request('eth_getUncleCountByBlockHash', [blockHash]);
        return typeof result === 'string' ? parseInt(result, 16) : result;
    }

    async getUncleByBlockNumberAndIndex(blockNumber, index) {
        const blockTag = typeof blockNumber === 'number' ? this.toHex(blockNumber) : blockNumber;
        const uncleIndex = typeof index === 'number' ? this.toHex(index) : index;
        return await this.request('eth_getUncleByBlockNumberAndIndex', [blockTag, uncleIndex]);
    }

    async getUncleByBlockHashAndIndex(blockHash, index) {
        const uncleIndex = typeof index === 'number' ? this.toHex(index) : index;
        return await this.request('eth_getUncleByBlockHashAndIndex', [blockHash, uncleIndex]);
    }

    // Transaction Methods
    async sendTransaction(txObject) {
        return await this.request('eth_sendTransaction', [txObject]);
    }

    async sendRawTransaction(signedTx) {
        return await this.request('eth_sendRawTransaction', [signedTx]);
    }

    async getTransactionByHash(txHash) {
        return await this.request('eth_getTransactionByHash', [txHash]);
    }

    async getTransactionByBlockNumberAndIndex(blockNumber, index) {
        const blockTag = typeof blockNumber === 'number' ? this.toHex(blockNumber) : blockNumber;
        const txIndex = typeof index === 'number' ? this.toHex(index) : index;
        return await this.request('eth_getTransactionByBlockNumberAndIndex', [blockTag, txIndex]);
    }

    async getTransactionByBlockHashAndIndex(blockHash, index) {
        const txIndex = typeof index === 'number' ? this.toHex(index) : index;
        return await this.request('eth_getTransactionByBlockHashAndIndex', [blockHash, txIndex]);
    }

    async getTransactionReceipt(txHash) {
        return await this.request('eth_getTransactionReceipt', [txHash]);
    }

    // Gas and Fee Methods
    async getGasPrice() {
        const result = await this.request('eth_gasPrice');
        return typeof result === 'string' ? BigInt(result).toString() : result;
    }

    async estimateGas(txObject, blockTag = 'latest') {
        const result = await this.request('eth_estimateGas', [txObject, blockTag]);
        return typeof result === 'string' ? parseInt(result, 16).toString() : result;
    }

    async feeHistory(blockCount, newestBlock = 'latest', rewardPercentiles = []) {
        const count = typeof blockCount === 'number' ? this.toHex(blockCount) : blockCount;
        const newest = typeof newestBlock === 'number' ? this.toHex(newestBlock) : newestBlock;
        return await this.request('eth_feeHistory', [count, newest, rewardPercentiles]);
    }

    async maxPriorityFeePerGas() {
        const result = await this.request('eth_maxPriorityFeePerGas');
        return typeof result === 'string' ? BigInt(result).toString() : result;
    }

    // Contract Interaction Methods
    async call(callObject, blockTag = 'latest') {
        return await this.request('eth_call', [callObject, blockTag]);
    }

    async createAccessList(callObject, blockTag = 'latest') {
        return await this.request('eth_createAccessList', [callObject, blockTag]);
    }

    // Filter and Log Methods
    async newFilter(filterObject) {
        return await this.request('eth_newFilter', [filterObject]);
    }

    async newBlockFilter() {
        return await this.request('eth_newBlockFilter');
    }

    async newPendingTransactionFilter() {
        return await this.request('eth_newPendingTransactionFilter');
    }

    async uninstallFilter(filterId) {
        return await this.request('eth_uninstallFilter', [filterId]);
    }

    async getFilterChanges(filterId) {
        return await this.request('eth_getFilterChanges', [filterId]);
    }

    async getFilterLogs(filterId) {
        return await this.request('eth_getFilterLogs', [filterId]);
    }

    async getLogs(filterObject) {
        return await this.request('eth_getLogs', [filterObject]);
    }

    // Network and Node Methods
    async chainId() {
        const result = await this.request('eth_chainId');
        return typeof result === 'string' ? parseInt(result, 16) : result;
    }

    async netVersion() {
        return await this.request('net_version');
    }

    async netListening() {
        return await this.request('net_listening');
    }

    async netPeerCount() {
        const result = await this.request('net_peerCount');
        return typeof result === 'string' ? parseInt(result, 16) : result;
    }

    async protocolVersion() {
        return await this.request('eth_protocolVersion');
    }

    async syncing() {
        return await this.request('eth_syncing');
    }

    async coinbase() {
        return await this.request('eth_coinbase');
    }

    async mining() {
        return await this.request('eth_mining');
    }

    async hashrate() {
        const result = await this.request('eth_hashrate');
        return typeof result === 'string' ? parseInt(result, 16) : result;
    }

    async getWork() {
        return await this.request('eth_getWork');
    }

    async submitWork(nonce, powHash, mixDigest) {
        return await this.request('eth_submitWork', [nonce, powHash, mixDigest]);
    }

    async submitHashrate(hashrate, id) {
        return await this.request('eth_submitHashrate', [hashrate, id]);
    }

    // Account Management (if supported)
    async accounts() {
        return await this.request('eth_accounts');
    }

    async sign(address, message) {
        return await this.request('eth_sign', [address, message]);
    }

    async signTransaction(txObject) {
        return await this.request('eth_signTransaction', [txObject]);
    }

    // Debug and Trace Methods (if supported by client)
    async debugTraceTransaction(txHash, options = {}) {
        return await this.request('debug_traceTransaction', [txHash, options]);
    }

    async debugTraceCall(callObject, blockTag = 'latest', options = {}) {
        return await this.request('debug_traceCall', [callObject, blockTag, options]);
    }

    async debugTraceBlockByNumber(blockNumber, options = {}) {
        const blockTag = typeof blockNumber === 'number' ? this.toHex(blockNumber) : blockNumber;
        return await this.request('debug_traceBlockByNumber', [blockTag, options]);
    }

    async debugTraceBlockByHash(blockHash, options = {}) {
        return await this.request('debug_traceBlockByHash', [blockHash, options]);
    }

    // Web3 Methods
    async web3ClientVersion() {
        return await this.request('web3_clientVersion');
    }

    async web3Sha3(data) {
        return await this.request('web3_sha3', [data]);
    }

    // Utility Methods
    toHex(value) {
        if (typeof value === 'string') {
            if (value.startsWith('0x')) return value;
            if (['latest', 'earliest', 'pending'].includes(value)) return value;
        }
        return '0x' + BigInt(value).toString(16);
    }

    fromHex(hexString) {
        return parseInt(hexString, 16);
    }

    toWei(value, unit = 'ether') {
        const units = {
            wei: 1n,
            kwei: 1000n,
            mwei: 1000000n,
            gwei: 1000000000n,
            szabo: 1000000000000n,
            finney: 1000000000000000n,
            ether: 1000000000000000000n
        };
        
        const multiplier = units[unit.toLowerCase()];
        if (!multiplier) throw new Error(`Unknown unit: ${unit}`);
        
        return (BigInt(value) * multiplier).toString();
    }

    fromWei(value, unit = 'ether') {
        const units = {
            wei: 1n,
            kwei: 1000n,
            mwei: 1000000n,
            gwei: 1000000000n,
            szabo: 1000000000000n,
            finney: 1000000000000000n,
            ether: 1000000000000000000n
        };
        
        const divisor = units[unit.toLowerCase()];
        if (!divisor) throw new Error(`Unknown unit: ${unit}`);
        
        return (BigInt(value) / divisor).toString();
    }

    // Batch request helper
    async batchRequest(requests) {
        const promises = requests.map(req => this.request(req.method, req.params));
        return await Promise.all(promises);
    }

    // ========================================
    // CUSTOM TESTING AND DEVELOPMENT METHODS
    // ========================================

    /**
     * Mine a new block (for testing)
     * @returns {Promise<number|null>} The new block number or null if mining failed
     */
    async mine() {
        const result = await this.request('evm_mine', []);
        if (result !== false) {
            this.blocknumber = await this.getBlockNumber();
            return this.blocknumber;
        }
        return null;
    }

    /**
     * Reset the chain to initial state (for testing with Anvil)
     * @returns {Promise<boolean>} Success status
     */
    async reset() {
        this.snapdelete();
        const result = await this.request('anvil_reset', [{ 
            forking: { jsonRpcUrl: this.ipcPath } 
        }]);
        
        if (result !== false) {
            this.snap = await this.request('evm_snapshot', []);
            this.blocknumber = await this.getBlockNumber();
            this.forkedblock = this.blocknumber;
        }
        return result;
    }

    /**
     * Reset to last snapshot or create new one
     * @returns {Promise<void>}
     */
    async snapreset() {
        if (!this.snap) {
            await this.reset();
        } else {
            const revertResult = await this.request('evm_revert', [this.snap]);
            if (revertResult !== false) {
                this.snap = await this.request('evm_snapshot', []);
                this.blocknumber = await this.getBlockNumber();
                this.forkedblock = this.blocknumber;
            }
        }
    }

    /**
     * Delete current snapshot
     */
    snapdelete() {
        if (this.snap) {
            delete this.snap;
        }
    }

    /**
     * Get mint events for a specific address within a block range
     * @param {string} address - Contract address
     * @param {number|string} fromBlock - Start block
     * @param {number|string} toBlock - End block
     * @returns {Promise<Array>} Array of mint events
     */
    async getMint(address, fromBlock, toBlock) {
        return await this.request('eth_getLogs', [{
            fromBlock: this.toHex(fromBlock),
            toBlock: this.toHex(toBlock),
            address: address,
            topics: ['0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f']
        }]);
    }

    /**
     * Get past logs for a specific address within a block range with custom topics
     * @param {string} address - Contract address
     * @param {number|string} fromBlock - Start block
     * @param {number|string} toBlock - End block
     * @param {Array<string>} topic - Array of topics to filter
     * @returns {Promise<Array>} Array of matching logs
     */
    async getPastLogs(address, fromBlock, toBlock, topic) {
        return await this.request('eth_getLogs', [{
            fromBlock: this.toHex(fromBlock),
            toBlock: this.toHex(toBlock),
            address: address,
            topics: topic
        }]);
    }
}

export default IPCProvider;
