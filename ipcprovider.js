import net from 'net';
import { v4 as uuidv4 } from 'uuid';

/**
 * High-Performance IPC Ethereum Provider with Advanced Optimizations
 * Enhanced version with performance improvements and stability features
 */
export class IPCProvider {
    constructor(ipcPath = '/home/chain/exec/geth.ipc', options = {}) {
        this.ipcPath = ipcPath;
        this.socket = null;
        this.isConnected = false;
        this.pendingRequests = new Map();
        
        // Performance optimizations - use Buffer instead of string
        this.buffer = Buffer.alloc(0);
        this.bufferSize = options.bufferSize || 2 * 1024 * 1024; // 2MB default buffer for better protection
        
        // Request pooling for better memory management
        this.requestPool = [];
        this.poolSize = options.poolSize || 100;
        
        // Performance configuration
        this.requestTimeout = options.requestTimeout || 30000;
        this.logResponseTime = options.logResponseTime !== false;
        this.batchRequests = options.batchRequests || false;
        this.batchSize = options.batchSize || 10;
        this.batchTimeout = options.batchTimeout || 10; // ms
        

        
        // Retry configuration with exponential backoff
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.maxRetryDelay = options.maxRetryDelay || 10000;
        this.backoffMultiplier = options.backoffMultiplier || 2;
        this.autoReconnect = options.autoReconnect !== false;
        this.currentRetries = 0;
        this.isReconnecting = false;
        
        // Caching for frequently requested data
        this.cache = new Map();
        this.cacheEnabled = options.cacheEnabled || false;
        this.cacheTTL = options.cacheTTL || 5000; // 5 seconds
        this.cacheSize = options.cacheSize || 1000;
        
        // Auto-disconnect configuration
        this.autoDisconnectEnabled = options.autoDisconnectEnabled || false;
        this.autoDisconnectTimeout = options.autoDisconnectTimeout || 5 * 60 * 1000; // 5 minutes default
        this.inactivityTimer = null;
        this.lastActivityTime = Date.now();
        
        // Prevent duplicate concurrent requests for same cache key
        this.pendingCacheKeys = new Map();
        
        // Optional logging interface
        this.logger = options.logger || console;
        
        // Metrics and monitoring
        this.metrics = {
            totalRequests: 0,
            totalResponseTime: 0,
            avgResponseTime: 0,
            minResponseTime: null,
            maxResponseTime: null,
            errors: 0,
            reconnections: 0,
            cacheHits: 0,
            cacheMisses: 0,
            droppedRequests: 0
        };
        
        // Batch request queue
        this.batchQueue = [];
        this.batchTimer = null;
        
        // Disconnect state management
        this.isDisconnecting = false;
        
        // Performance tracking
        this.startTime = Date.now();
        
        // Read-only methods for caching (using Set for faster lookup)
        this.readOnlyMethods = new Set([
            'eth_blockNumber', 'eth_getBalance', 'eth_getCode',
            'eth_getTransactionByHash', 'eth_getTransactionReceipt',
            'eth_getBlockByNumber', 'eth_getBlockByHash',
            'eth_gasPrice', 'eth_getTransactionCount', 'net_version'
        ]);
        
        // Block tracking
        this.blocknumber = null;
        this.forkedblock = null;
        this.snap = null;
        
        // Initialize object pool
        this.initializeRequestPool();
    }

    // Initialize request object pool for memory efficiency
    initializeRequestPool() {
        for (let i = 0; i < this.poolSize; i++) {
            this.requestPool.push({
                id: null,
                jsonrpc: '2.0',
                method: null,
                params: null
            });
        }
    }

    // Get request object from pool
    getRequestFromPool() {
        return this.requestPool.pop() || {
            id: null,
            jsonrpc: '2.0',
            method: null,
            params: null
        };
    }

    // Return request object to pool
    returnRequestToPool(request) {
        if (this.requestPool.length < this.poolSize) {
            request.id = null;
            request.method = null;
            request.params = null;
            this.requestPool.push(request);
        }
    }

    // Enhanced cache implementation with LRU eviction
    getCachedResult(key) {
        const cached = this.cache.get(key);
        if (cached) {
            const now = Date.now();
            if (now - cached.timestamp < this.cacheTTL) {
                this.metrics.cacheHits++;
                // Move to end for LRU
                this.cache.delete(key);
                this.cache.set(key, cached);
                return cached.data;
            } else {
                this.cache.delete(key);
            }
        }
        this.metrics.cacheMisses++;
        return null;
    }

    setCachedResult(key, data) {
        if (!this.cacheEnabled) return;
        
        // Implement LRU eviction
        if (this.cache.size >= this.cacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    // Enhanced connection with socket optimization
    async connect() {
        return new Promise((resolve, reject) => {
            this.logger.log(`🔌 Connecting to IPC at: ${this.ipcPath}`);

            this.socket = net.connect(this.ipcPath);
            
            // Socket performance optimizations
            this.socket.setNoDelay(true); // Disable Nagle's algorithm for lower latency
            
            // Set larger buffer sizes for better throughput
            this.socket.setDefaultEncoding('utf8');

            this.socket.on('connect', () => {
                this.logger.log('✅ Connected to IPC socket');
                this.isConnected = true;
                this.currentRetries = 0;
                this.isReconnecting = false;
                
                // Start inactivity timer
                this.startInactivityTimer();
                
                resolve();
            });

            this.socket.on('error', (error) => {
                this.logger.error('❌ IPC connection error:', error.message);
                this.isConnected = false;
                this.metrics.errors++;
                reject(error);
            });

            this.socket.on('close', () => {
                this.logger.log('🔌 IPC connection closed');
                this.isConnected = false;
                this.stopInactivityTimer();

                if (this.autoReconnect && !this.isReconnecting) {
                    this.attemptReconnect();
                }
            });

            this.socket.on('data', (data) => {
                this.handleResponse(data);
            });

            this.socket.on('end', () => {
                this.logger.warn('🔚 Socket ended by server');
                this.isConnected = false;
                this.stopInactivityTimer();
                
                if (this.autoReconnect && !this.isReconnecting) {
                    this.attemptReconnect();
                }
            });

            this.socket.on('timeout', () => {
                this.logger.warn('⏱️ Socket timeout');
                this.metrics.errors++;
                
                if (this.autoReconnect && !this.isReconnecting) {
                    this.attemptReconnect();
                }
            });
        });
    }



    // Start inactivity timer for auto-disconnect
    startInactivityTimer() {
        if (!this.autoDisconnectEnabled) return;
        
        // Clear existing timer
        this.stopInactivityTimer();
        
        this.inactivityTimer = setTimeout(() => {
            const timeSinceLastActivity = Date.now() - this.lastActivityTime;
            
            // Check if we're truly inactive (no pending requests)
            if (timeSinceLastActivity >= this.autoDisconnectTimeout && 
                this.pendingRequests.size === 0 && 
                this.batchQueue.length === 0) {
                
                this.logger.log(`⏰ Auto-disconnecting due to ${this.autoDisconnectTimeout / 1000}s inactivity`);
                this.disconnect().catch(error => {
                    this.logger.warn('⚠️ Auto-disconnect failed:', error.message);
                });
            } else {
                // Restart timer if there's still activity or pending requests
                this.startInactivityTimer();
            }
        }, this.autoDisconnectTimeout);
    }
    
    // Stop inactivity timer
    stopInactivityTimer() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }
    
    // Update last activity time and restart timer
    updateActivity() {
        this.lastActivityTime = Date.now();
        if (this.autoDisconnectEnabled && this.isConnected) {
            this.startInactivityTimer();
        }
    }

    // Enhanced reconnection with exponential backoff
    async attemptReconnect() {
        if (this.isReconnecting || this.isDisconnecting) {
            if (this.isDisconnecting) {
                this.logger.log('🛑 Reconnect aborted (disconnecting)');
            }
            return;
        }

        this.isReconnecting = true;
        this.metrics.reconnections++;

        let currentDelay = this.retryDelay;

        while (this.currentRetries < this.maxRetries && this.autoReconnect && !this.isDisconnecting) {
            this.currentRetries++;
            this.logger.log(`🔄 Reconnecting... (${this.currentRetries}/${this.maxRetries})`);

            try {
                await new Promise(resolve => setTimeout(resolve, currentDelay));
                await this.connect();
                this.logger.log('✅ Reconnection successful!');
                return;

            } catch (error) {
                this.logger.warn(`❌ Reconnection ${this.currentRetries} failed: ${error.message}`);
                
                // Exponential backoff with jitter
                currentDelay = Math.min(
                    currentDelay * this.backoffMultiplier + Math.random() * 1000,
                    this.maxRetryDelay
                );

                if (this.currentRetries >= this.maxRetries) {
                    this.logger.error('💥 Max reconnection attempts reached');
                    this.isReconnecting = false;
                    break;
                }
            }
        }

        this.isReconnecting = false;
    }

    // Optimized response handling with Buffer operations
    handleResponse(data) {
        // Append to buffer efficiently with size protection
        const newBufferSize = this.buffer.length + data.length;
        if (newBufferSize > this.bufferSize) {
            this.logger.warn(`⚠️ Buffer exceeded ${this.bufferSize} bytes. Resetting.`);
            this.buffer = Buffer.alloc(0);
            this.metrics.errors++;
            this.metrics.droppedRequests++;
            return;
        }
        
        this.buffer = Buffer.concat([this.buffer, data]);

        // Optimization: Check for newline-separated JSON first (common in Geth/Anvil)
        if (this.buffer.includes(0x0A)) { // newline character
            const bufferStr = this.buffer.toString();
            const messages = bufferStr.split('\n').filter(Boolean);
            
            let processedBytes = 0;
            for (const jsonStr of messages) {
                try {
                    const response = JSON.parse(jsonStr);
                    this._processSingleResponse(response);
                    processedBytes += Buffer.byteLength(jsonStr) + 1; // +1 for newline
                } catch (error) {
                    // Not valid JSON, break and fall back to brace counting
                    break;
                }
            }
            
            // Remove processed messages from buffer
            if (processedBytes > 0) {
                this.buffer = this.buffer.subarray(processedBytes);
                return;
            }
        }

        // Fallback: Use brace-counting method for non-newline separated JSON
        let offset = 0;
        while (offset < this.buffer.length) {
            try {
                // Find complete JSON object using Buffer operations
                const result = this.findCompleteJSON(this.buffer, offset);
                if (!result) break;

                const { endOffset, jsonStr } = result;
                const response = JSON.parse(jsonStr);
                this._processSingleResponse(response);
                offset = endOffset;

            } catch (error) {
                break;
            }
        }

        // Clean up processed data from buffer
        if (offset > 0) {
            this.buffer = this.buffer.subarray(offset);
        }
    }

    // Extract response processing logic to separate method
    _processSingleResponse(response) {
        if (response.id && this.pendingRequests.has(response.id)) {
            const { resolve, reject, startTime, method, timeout } = this.pendingRequests.get(response.id);
            this.pendingRequests.delete(response.id);

            if (timeout) clearTimeout(timeout);

            // Update metrics with min/max tracking
            const responseTime = Date.now() - startTime;
            this.metrics.totalRequests++;
            this.metrics.totalResponseTime += responseTime;
            this.metrics.avgResponseTime = this.metrics.totalResponseTime / this.metrics.totalRequests;
            
            // Track min/max response times
            if (this.metrics.minResponseTime === null || responseTime < this.metrics.minResponseTime) {
                this.metrics.minResponseTime = responseTime;
            }
            if (this.metrics.maxResponseTime === null || responseTime > this.metrics.maxResponseTime) {
                this.metrics.maxResponseTime = responseTime;
            }

            if (this.logResponseTime) {
                this.logger.log(`⏱️  ${method} completed in ${responseTime}ms`);
            }

            if (response.error) {
                this.metrics.errors++;
                reject(new Error(response.error.message));
            } else {
                resolve(response.result);
            }
        }
    }

    // Optimized JSON boundary detection
    findCompleteJSON(buffer, startOffset) {
        let braceCount = 0;
        let inString = false;
        let escape = false;
        let foundStart = false;

        for (let i = startOffset; i < buffer.length; i++) {
            const byte = buffer[i];

            if (escape) {
                escape = false;
                continue;
            }

            if (byte === 0x5C) { // backslash \
                escape = true;
                continue;
            }

            if (byte === 0x22) { // double quote "
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (byte === 0x7B) { // opening brace {
                    braceCount++;
                    foundStart = true;
                } else if (byte === 0x7D && foundStart) { // closing brace }
                    braceCount--;
                    if (braceCount === 0) {
                        const jsonStr = buffer.subarray(startOffset, i + 1).toString();
                        return { endOffset: i + 1, jsonStr };
                    }
                }
            }
        }

        return null;
    }

    // Batch request processing for better throughput
    async processBatch() {
        if (this.batchQueue.length === 0 || this.isDisconnecting) return;

        const batch = this.batchQueue.splice(0, this.batchSize);
        const batchRequest = batch.map(item => ({
            id: item.id,
            jsonrpc: '2.0',
            method: item.method,
            params: item.params
        }));

        try {
            const requestData = JSON.stringify(batchRequest) + '\n';
            this.socket.write(requestData);
            this.logger.log(`📦 Sent batch request with ${batch.length} items`);
        } catch (error) {
            // Reject all batch items on error
            batch.forEach(item => {
                if (item.timeout) clearTimeout(item.timeout);
                item.reject(error);
            });
        }
    }

    // Enhanced request method with caching and batching
    async request(method, params = []) {
        if (!this.isConnected) {
            throw new Error('Not connected to IPC socket');
        }

        // Update activity time for auto-disconnect
        this.updateActivity();

        // Check cache for read-only methods
        const cacheKey = `${method}:${JSON.stringify(params)}`;
        if (this.cacheEnabled && this.readOnlyMethods.has(method)) {
            const cached = this.getCachedResult(cacheKey);
            if (cached !== null) {
                return cached;
            }

            // Prevent duplicate concurrent requests for same cache key
            if (this.pendingCacheKeys.has(cacheKey)) {
                return this.pendingCacheKeys.get(cacheKey); // reuse in-flight promise
            }
        }

        const requestPromise = new Promise((resolve, reject) => {
            const id = uuidv4();
            const startTime = Date.now();
            
            // Get request object from pool
            const request = this.getRequestFromPool();
            request.id = id;
            request.method = method;
            request.params = params;

            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    this.returnRequestToPool(request);
                    reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
                }
            }, this.requestTimeout);

            const requestMeta = {
                resolve: (result) => {
                    this.returnRequestToPool(request);
                    // Cache result for read-only methods
                    if (this.cacheEnabled && this.readOnlyMethods.has(method)) {
                        this.setCachedResult(cacheKey, result);
                    }
                    resolve(result);
                },
                reject: (error) => {
                    this.returnRequestToPool(request);
                    reject(error);
                },
                startTime,
                method,
                timeout
            };

            this.pendingRequests.set(id, requestMeta);

            if (this.batchRequests) {
                // Add to batch queue
                this.batchQueue.push({
                    id, method, params,
                    resolve: requestMeta.resolve,
                    reject: requestMeta.reject,
                    timeout
                });

                // Process batch if queue is full or timeout
                if (this.batchQueue.length >= this.batchSize) {
                    this.processBatch();
                } else if (!this.batchTimer) {
                    this.batchTimer = setTimeout(() => {
                        this.processBatch();
                        this.batchTimer = null;
                    }, this.batchTimeout);
                }
            } else {
                // Send single request with newline termination for proper Geth/Anvil compatibility
                const requestJson = JSON.stringify(request);
                this.socket.write(requestJson + '\n');
                this.logger.log(`📤 Sent request: ${method}`);
            }
        });

        // Track pending cache keys to prevent duplicates
        if (this.cacheEnabled && this.readOnlyMethods.has(method)) {
            this.pendingCacheKeys.set(cacheKey, requestPromise);
            requestPromise.finally(() => this.pendingCacheKeys.delete(cacheKey));
        }

        return requestPromise;
    }

    // Get performance metrics
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.cache.size,
            pendingRequests: this.pendingRequests.size,
            bufferSize: this.buffer.length,
            poolSize: this.requestPool.length
        };
    }

    // Print comprehensive metrics summary for monitoring
    printMetricsSummary() {
        const metrics = this.getMetrics();
        const uptime = Date.now() - (this.startTime || Date.now());
        const uptimeSeconds = uptime / 1000;
        const tps = uptimeSeconds > 0 ? (metrics.totalRequests / uptimeSeconds).toFixed(2) : '0.00';
        const cacheHitRatio = metrics.cacheHits + metrics.cacheMisses > 0 
            ? ((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(1)
            : '0.0';

        this.logger.log('\n📊 IPC Provider Performance Summary');
        this.logger.log('=====================================');
        this.logger.log(`🚀 Throughput: ${tps} requests/sec`);
        this.logger.log(`⚡ Response Times: min=${metrics.minResponseTime}ms, avg=${metrics.avgResponseTime.toFixed(2)}ms, max=${metrics.maxResponseTime}ms`);
        this.logger.log(`💾 Cache Hit Ratio: ${cacheHitRatio}% (${metrics.cacheHits} hits, ${metrics.cacheMisses} misses)`);
        this.logger.log(`🔄 Reconnections: ${metrics.reconnections}`);
        this.logger.log(`❌ Errors: ${metrics.errors}`);
        this.logger.log(`📉 Dropped Requests: ${metrics.droppedRequests || 0}`);
        this.logger.log(`📈 Total Requests: ${metrics.totalRequests}`);
        this.logger.log(`🏊 Pool Usage: ${metrics.poolSize} objects available`);
        this.logger.log(`📦 Buffer Usage: ${metrics.bufferSize} bytes`);
        this.logger.log(`🔗 Connection: ${this.isConnected ? 'Active' : 'Inactive'}`);
        this.logger.log(`⏱️  Uptime: ${(uptimeSeconds / 60).toFixed(1)} minutes`);
        this.logger.log('=====================================\n');
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        this.logger.log('🧹 Cache cleared');
    }

    // Health check
    async healthCheck() {
        try {
            const start = Date.now();
            await this.request('net_version');
            const latency = Date.now() - start;
            
            return {
                status: 'healthy',
                latency,
                connected: this.isConnected,
                metrics: this.getMetrics()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                connected: this.isConnected,
                metrics: this.getMetrics()
            };
        }
    }

    // Enhanced send method with error handling
    async send(method, params = []) {
        try {
            return await this.request(method, params);
        } catch (error) {
            this.logger.warn(`⚠️  ${method} failed: ${error.message}`);
            this.metrics.errors++;
            return false;
        }
    }

    // Contract call (view/pure functions)
    async call(to, data, blockTag = 'latest') {
        try {
            const callObject = { to, data };
            return await this.request('eth_call', [callObject, blockTag]);
        } catch (error) {
            this.logger.warn(`⚠️  eth_call failed: ${error.message}`);
            return false;
        }
    }

    async sendTransaction(txObject) {
        return await this.request('eth_sendTransaction', [txObject]);
    }

    async sendRawTransaction(signedTx) {
        return await this.request('eth_sendRawTransaction', [signedTx]);
    }

    async getTransactionReceipt(txHash) {
        return await this.request('eth_getTransactionReceipt', [txHash]);
    }

    async getBalance(address, blockTag = 'latest') {
        const result = await this.request('eth_getBalance', [address, blockTag]);
        if (typeof result === 'string' && result.startsWith('0x')) {
            return BigInt(result).toString();
        }
        return typeof result === 'number' ? result.toString() : result;
    }

    async getBlockNumber() {
        const result = await this.request('eth_blockNumber');
        if (typeof result === 'string' && result.startsWith('0x')) {
            return parseInt(result, 16).toString();
        }
        return typeof result === 'number' ? result.toString() : result;
    }

    async getGasPrice() {
        const result = await this.request('eth_gasPrice');
        if (typeof result === 'string' && result.startsWith('0x')) {
            return BigInt(result).toString();
        }
        return typeof result === 'number' ? result.toString() : result;
    }

    async estimateGas(txObject) {
        const result = await this.request('eth_estimateGas', [txObject]);
        if (typeof result === 'string' && result.startsWith('0x')) {
            return parseInt(result, 16).toString();
        }
        return typeof result === 'number' ? result.toString() : result;
    }

    // Advanced Ethereum methods
    async getCurrentBlock() {
        const blockNumber = await this.send('eth_blockNumber', []);
        if (blockNumber === false) return false;
        return parseInt(blockNumber, 16);
    }

    async getBlock(number) {
        if (number) {
            const hexNumber = '0x' + number.toString(16);
            return await this.send('eth_getBlockByNumber', [hexNumber, false]);
        } else {
            return await this.send('eth_getBlockByNumber', ['latest', true]);
        }
    }

    async getNonce(address) {
        return await this.getTransactionCount(address);
    }

    async getTransactionCount(address, blockTag = 'latest') {
        const result = await this.send('eth_getTransactionCount', [address, blockTag]);
        if (result === false) return false;
        if (typeof result === 'string' && result.startsWith('0x')) {
            return parseInt(result, 16);
        }
        return typeof result === 'number' ? result : 0;
    }

    async getBlockReceipts() {
        return await this.send('eth_getBlockReceipts', ['latest']);
    }

    async getReceipt(hash) {
        return await this.send('eth_getTransactionReceipt', [hash]);
    }

    // Anvil/Hardhat specific methods (kept for compatibility)
    async mine() {
        const result = await this.send('evm_mine', []);
        if (result !== false) {
            this.blocknumber = await this.getCurrentBlock();
            return this.blocknumber;
        }
        return null;
    }

    async reset() {
        this.snapdelete();
        const result = await this.send('anvil_reset', [{ forking: { jsonRpcUrl: this.ipcPath } }]);
        if (result !== false) {
            this.snap = await this.send('evm_snapshot', []);
            this.blocknumber = await this.getCurrentBlock();
            this.forkedblock = this.blocknumber
        }
        return result;
    }

    async snapreset() {
        if (!this.snap) {
            await this.reset();
        } else {
            const revertResult = await this.send('evm_revert', [this.snap]);
            if (revertResult !== false) {
                this.snap = await this.send('evm_snapshot', []);
                this.blocknumber = await this.getCurrentBlock();
                this.forkedblock = this.blocknumber
            }
        }
    }

    snapdelete() {
        if (this.snap) {
            delete this.snap;
        }
    }

    // Transaction and code inspection methods
    async getTraceTransaction(hash) {
        const result = await this.send("debug_traceTransaction", [hash, {
            tracer: 'callTracer',
            timeout: '60s'
        }]);
        return result !== false ? result : null;
    }

    async getTransaction(hash) {
        const result = await this.send("eth_getTransactionByHash", [hash]);
        return result !== false ? result : null;
    }

    async getCode(address) {
        const result = await this.send("eth_getCode", [address, "latest"]);
        return result !== false ? result : null;
    }

    async getRawTransaction(hash) {
        const result = await this.send("eth_getRawTransactionByHash", [hash]);
        return result !== false ? result : null;
    }

    // Helper method to convert numbers to hex format
    toHex(value) {
        if (typeof value === 'string') {
            if (value.startsWith('0x')) {
                return value; // Already hex
            }
            if (value === 'latest' || value === 'earliest' || value === 'pending') {
                return value; // Special block tags
            }
        }
        return '0x' + parseInt(value).toString(16);
    }

    // Get mint events for a specific address within a block range
    async getMint(address, fromBlock, toBlock) {
        return await this.send('eth_getLogs', [{
            "fromBlock": this.toHex(fromBlock),
            "toBlock": this.toHex(toBlock),
            "address": address,
            "topics": ["0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f"]
        }]);
    }

    // Get past logs for a specific address within a block range with custom topics
    async getPastLogs(address, fromBlock, toBlock, topic) {
        return await this.send('eth_getLogs', [{
            "fromBlock": this.toHex(fromBlock),
            "toBlock": this.toHex(toBlock),
            "address": address,
            "topics": topic
        }]);
    }

    // Enhanced disconnect with proper cleanup
    async disconnect() {
        this.logger.log('Disconnecting from IPC');

        this.autoReconnect = false;
        this.isReconnecting = false;
        this.isDisconnecting = true; // Set disconnecting flag to prevent race conditions
        
        // Stop timers
        this.stopInactivityTimer();
        
        // Clear batch timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        // Flush pending batch before disconnecting
        if (this.batchQueue.length > 0) {
            this.logger.log(`📦 Flushing ${this.batchQueue.length} pending batch requests before disconnect`);
            try {
                await this.processBatch();
                // Wait a bit for responses
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                this.logger.warn('⚠️ Failed to flush batch requests:', error.message);
            }
        }

        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }

        // Clean up pending requests
        for (const [id, { reject, timeout }] of this.pendingRequests) {
            if (timeout) clearTimeout(timeout);
            reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();

        // Clean up any remaining batch queue items
        this.batchQueue.forEach(item => {
            if (item.timeout) clearTimeout(item.timeout);
            item.reject(new Error('Connection closed'));
        });
        this.batchQueue = [];

        // Clear cache
        this.cache.clear();
        
        // Reset buffer
        this.buffer = Buffer.alloc(0);

        this.isConnected = false;
        this.logger.log('✅ Disconnected successfully');
    }
}

export default IPCProvider;
