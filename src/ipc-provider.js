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

        // Automatically connect on instantiation
        this.connect().catch(err => {
            this.logger.error('Failed to connect on instantiation:', err);
        });
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
     */
    handleIncomingData(data) {
        const responses = this.jsonParser.processData(data);
        
        for (const response of responses) {
            if (response.id && this.pendingRequests.has(response.id)) {
                const { resolve, reject, tracking, timeout } = this.pendingRequests.get(response.id);
                this.pendingRequests.delete(response.id);
                clearTimeout(timeout);

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
        if (this.connection.isConnected) {
            return;
        }
        await this.connection.connect();
        this.logger.log('Provider connected to IPC socket');
    }

    /**
     * Ensure connection is established
     */
    async ensureConnected() {
        if (!this.connection.isConnected) {
            await this.connect();
        }
    }

    /**
     * Make an RPC request
     */
    async request(methodOrPayload, params) {
        await this.ensureConnected();

        let method, parameters;
        
        if (typeof methodOrPayload === 'object') {
            method = methodOrPayload.method;
            parameters = methodOrPayload.params || [];
        } else {
            method = methodOrPayload;
            parameters = params || [];
        }

        if (this.readOnlyMethods.has(method)) {
            const cacheKey = `${method}:${JSON.stringify(parameters)}`;
            const cached = this.cache.get(cacheKey);
            if (cached !== null) {
                return cached;
            }
        }

        const id = uuidv4();
        const tracking = this.metrics.recordRequestStart(method, id);
        
        const request = {
            jsonrpc: '2.0',
            id,
            method,
            params: parameters
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    this.metrics.recordRequestFailure(tracking, new Error('Request timeout'), 'timeout');
                    reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
                }
            }, this.requestTimeout);

            this.pendingRequests.set(id, { resolve, reject, tracking, timeout });

            try {
                const requestJson = JSON.stringify(request) + '\n';
                this.connection.write(requestJson);
            } catch (error) {
                this.pendingRequests.delete(id);
                clearTimeout(timeout);
                this.metrics.recordRequestFailure(tracking, error);
                reject(error);
            }
        });
    }

    /**
     * Disconnect from IPC endpoint
     */
    async disconnect() {
        if (this.connection.isConnected) {
            await this.connection.disconnect();
            this.logger.log('Provider disconnected from IPC socket');
        }
    }

    // Ethereum JSON-RPC method implementations
    async getBlockNumber() {
        const result = await this.request('eth_blockNumber');
        return typeof result === 'string' ? parseInt(result, 16) : result;
    }

    async getBalance(address, blockTag = 'latest') {
        const result = await this.request('eth_getBalance', [address, blockTag]);
        return typeof result === 'string' ? BigInt(result).toString() : result;
    }

    async getTransactionCount(address, blockTag = 'latest') {
        const result = await this.request('eth_getTransactionCount', [address, blockTag]);
        return typeof result === 'string' ? parseInt(result, 16) : result;
    }

    // Helper methods
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
}

export default IPCProvider;
