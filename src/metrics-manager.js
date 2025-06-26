/**
 * Comprehensive Metrics Manager for performance monitoring
 * Tracks detailed statistics with minimal performance overhead
 */
export class MetricsManager {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.trackResponseTimes = options.trackResponseTimes !== false;
        this.trackMemoryUsage = options.trackMemoryUsage || false;
        this.historySize = options.historySize || 1000;
        
        // Core metrics
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                timeouts: 0,
                retries: 0
            },
            responses: {
                totalTime: 0,
                minTime: null,
                maxTime: null,
                avgTime: 0,
                p50: 0,
                p95: 0,
                p99: 0
            },
            connection: {
                connects: 0,
                disconnects: 0,
                reconnects: 0,
                errors: 0,
                uptime: 0,
                downtime: 0
            },
            cache: {
                hits: 0,
                misses: 0,
                evictions: 0,
                hitRatio: 0
            },
            batch: {
                totalBatches: 0,
                totalBatchedRequests: 0,
                avgBatchSize: 0,
                batchProcessingTime: 0
            },
            memory: {
                bufferSize: 0,
                cacheSize: 0,
                poolSize: 0,
                heapUsed: 0,
                heapTotal: 0
            }
        };

        // Response time history for percentile calculations
        this.responseTimeHistory = [];
        this.startTime = Date.now();
        this.lastConnectionTime = null;
        this.connectionStartTime = null;
        
        // Method-specific metrics
        this.methodMetrics = new Map();
        
        // Error tracking
        this.errorHistory = [];
        this.maxErrorHistory = options.maxErrorHistory || 100;
        
        // Performance sampling
        this.sampleRate = options.sampleRate || 1.0; // 1.0 = 100% sampling
        
        this.logger = options.logger || console;
    }

    /**
     * Record a request start
     * @param {string} method - RPC method name
     * @param {string} requestId - Unique request identifier
     * @returns {object} Request tracking object
     */
    recordRequestStart(method, requestId) {
        if (!this.enabled || Math.random() > this.sampleRate) {
            return { tracked: false };
        }

        const startTime = Date.now();
        this.metrics.requests.total++;

        // Initialize method metrics if not exists
        if (!this.methodMetrics.has(method)) {
            this.methodMetrics.set(method, {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                errors: 0,
                minTime: null,
                maxTime: null
            });
        }

        const methodStats = this.methodMetrics.get(method);
        methodStats.count++;

        return {
            tracked: true,
            method,
            requestId,
            startTime,
            methodStats
        };
    }

    /**
     * Record a successful request completion
     * @param {object} tracking - Request tracking object from recordRequestStart
     */
    recordRequestSuccess(tracking) {
        if (!tracking.tracked) return;

        const endTime = Date.now();
        const responseTime = endTime - tracking.startTime;

        this.metrics.requests.successful++;
        this.updateResponseTimeMetrics(responseTime);
        this.updateMethodMetrics(tracking.method, responseTime, false);
    }

    /**
     * Record a failed request
     * @param {object} tracking - Request tracking object from recordRequestStart
     * @param {Error} error - Error object
     * @param {string} errorType - Type of error (timeout, network, parse, etc.)
     */
    recordRequestFailure(tracking, error, errorType = 'unknown') {
        if (!tracking.tracked) return;

        const endTime = Date.now();
        const responseTime = endTime - tracking.startTime;

        this.metrics.requests.failed++;
        
        if (errorType === 'timeout') {
            this.metrics.requests.timeouts++;
        }

        this.updateMethodMetrics(tracking.method, responseTime, true);
        this.recordError(error, errorType, tracking.method);
    }

    /**
     * Record a retry attempt
     */
    recordRetry() {
        if (!this.enabled) return;
        this.metrics.requests.retries++;
    }

    /**
     * Update response time metrics
     * @param {number} responseTime - Response time in milliseconds
     */
    updateResponseTimeMetrics(responseTime) {
        if (!this.trackResponseTimes) return;

        const responses = this.metrics.responses;
        
        responses.totalTime += responseTime;
        responses.avgTime = responses.totalTime / this.metrics.requests.successful;

        if (responses.minTime === null || responseTime < responses.minTime) {
            responses.minTime = responseTime;
        }

        if (responses.maxTime === null || responseTime > responses.maxTime) {
            responses.maxTime = responseTime;
        }

        // Add to history for percentile calculation
        this.responseTimeHistory.push(responseTime);
        
        // Limit history size
        if (this.responseTimeHistory.length > this.historySize) {
            this.responseTimeHistory.shift();
        }

        // Update percentiles (calculated on demand for performance)
        this.updatePercentiles();
    }

    /**
     * Update method-specific metrics
     * @param {string} method - RPC method name
     * @param {number} responseTime - Response time in milliseconds
     * @param {boolean} isError - Whether this was an error
     */
    updateMethodMetrics(method, responseTime, isError) {
        const methodStats = this.methodMetrics.get(method);
        if (!methodStats) return;

        if (isError) {
            methodStats.errors++;
        } else {
            methodStats.totalTime += responseTime;
            methodStats.avgTime = methodStats.totalTime / (methodStats.count - methodStats.errors);

            if (methodStats.minTime === null || responseTime < methodStats.minTime) {
                methodStats.minTime = responseTime;
            }

            if (methodStats.maxTime === null || responseTime > methodStats.maxTime) {
                methodStats.maxTime = responseTime;
            }
        }
    }

    /**
     * Calculate response time percentiles
     */
    updatePercentiles() {
        if (this.responseTimeHistory.length === 0) return;

        const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
        const responses = this.metrics.responses;

        responses.p50 = this.calculatePercentile(sorted, 0.5);
        responses.p95 = this.calculatePercentile(sorted, 0.95);
        responses.p99 = this.calculatePercentile(sorted, 0.99);
    }

    /**
     * Calculate specific percentile
     * @param {Array} sortedArray - Sorted array of values
     * @param {number} percentile - Percentile to calculate (0.0 to 1.0)
     * @returns {number} Percentile value
     */
    calculatePercentile(sortedArray, percentile) {
        const index = Math.ceil(sortedArray.length * percentile) - 1;
        return sortedArray[Math.max(0, index)];
    }

    /**
     * Record connection event
     * @param {string} event - Event type: 'connect', 'disconnect', 'reconnect', 'error'
     */
    recordConnectionEvent(event) {
        if (!this.enabled) return;

        const now = Date.now();
        const connection = this.metrics.connection;

        switch (event) {
            case 'connect':
                connection.connects++;
                this.connectionStartTime = now;
                break;
            case 'disconnect':
                connection.disconnects++;
                if (this.connectionStartTime) {
                    connection.uptime += now - this.connectionStartTime;
                    this.connectionStartTime = null;
                }
                this.lastConnectionTime = now;
                break;
            case 'reconnect':
                connection.reconnects++;
                if (this.lastConnectionTime) {
                    connection.downtime += now - this.lastConnectionTime;
                }
                this.connectionStartTime = now;
                break;
            case 'error':
                connection.errors++;
                break;
        }
    }

    /**
     * Record cache metrics
     * @param {object} cacheStats - Cache statistics object
     */
    recordCacheMetrics(cacheStats) {
        if (!this.enabled) return;

        const cache = this.metrics.cache;
        cache.hits = cacheStats.hits || 0;
        cache.misses = cacheStats.misses || 0;
        cache.evictions = cacheStats.evictions || 0;
        cache.hitRatio = cacheStats.hitRatio || 0;
    }

    /**
     * Record batch processing metrics
     * @param {object} batchStats - Batch statistics object
     */
    recordBatchMetrics(batchStats) {
        if (!this.enabled) return;

        const batch = this.metrics.batch;
        batch.totalBatches = batchStats.totalBatches || 0;
        batch.totalBatchedRequests = batchStats.totalRequests || 0;
        batch.avgBatchSize = batchStats.avgBatchSize || 0;
        batch.batchProcessingTime = batchStats.avgProcessingTime || 0;
    }

    /**
     * Record memory usage metrics
     * @param {object} memoryStats - Memory statistics object
     */
    recordMemoryMetrics(memoryStats) {
        if (!this.enabled || !this.trackMemoryUsage) return;

        const memory = this.metrics.memory;
        memory.bufferSize = memoryStats.bufferSize || 0;
        memory.cacheSize = memoryStats.cacheSize || 0;
        memory.poolSize = memoryStats.poolSize || 0;

        // Node.js memory usage
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const nodeMemory = process.memoryUsage();
            memory.heapUsed = nodeMemory.heapUsed;
            memory.heapTotal = nodeMemory.heapTotal;
        }
    }

    /**
     * Record error for tracking
     * @param {Error} error - Error object
     * @param {string} type - Error type
     * @param {string} method - RPC method (optional)
     */
    recordError(error, type, method = null) {
        if (!this.enabled) return;

        const errorRecord = {
            timestamp: Date.now(),
            type,
            message: error.message,
            method,
            stack: error.stack
        };

        this.errorHistory.push(errorRecord);

        // Limit error history size
        if (this.errorHistory.length > this.maxErrorHistory) {
            this.errorHistory.shift();
        }
    }

    /**
     * Get comprehensive metrics summary
     * @returns {object} Complete metrics object
     */
    getMetrics() {
        if (!this.enabled) {
            return { enabled: false };
        }

        const now = Date.now();
        const totalUptime = now - this.startTime;
        
        // Calculate current uptime if connected
        let currentUptime = this.metrics.connection.uptime;
        if (this.connectionStartTime) {
            currentUptime += now - this.connectionStartTime;
        }

        // Calculate success rate
        const totalRequests = this.metrics.requests.total;
        const successRate = totalRequests > 0 
            ? (this.metrics.requests.successful / totalRequests) * 100 
            : 0;

        // Calculate requests per second
        const requestsPerSecond = totalUptime > 0 
            ? (totalRequests / (totalUptime / 1000)) 
            : 0;

        return {
            enabled: true,
            timestamp: now,
            uptime: totalUptime,
            ...this.metrics,
            derived: {
                successRate: parseFloat(successRate.toFixed(2)),
                errorRate: parseFloat((100 - successRate).toFixed(2)),
                requestsPerSecond: parseFloat(requestsPerSecond.toFixed(2)),
                connectionUptime: currentUptime,
                connectionUptimeRatio: totalUptime > 0 
                    ? parseFloat(((currentUptime / totalUptime) * 100).toFixed(2))
                    : 0
            },
            methods: Object.fromEntries(this.methodMetrics),
            recentErrors: this.errorHistory.slice(-10) // Last 10 errors
        };
    }

    /**
     * Get method-specific metrics
     * @param {string} method - RPC method name
     * @returns {object|null} Method metrics or null if not found
     */
    getMethodMetrics(method) {
        return this.methodMetrics.get(method) || null;
    }

    /**
     * Get top methods by usage
     * @param {number} limit - Number of top methods to return
     * @returns {Array} Array of method metrics sorted by usage
     */
    getTopMethods(limit = 10) {
        const methods = Array.from(this.methodMetrics.entries())
            .map(([method, stats]) => ({ method, ...stats }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        return methods;
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            requests: { total: 0, successful: 0, failed: 0, timeouts: 0, retries: 0 },
            responses: { totalTime: 0, minTime: null, maxTime: null, avgTime: 0, p50: 0, p95: 0, p99: 0 },
            connection: { connects: 0, disconnects: 0, reconnects: 0, errors: 0, uptime: 0, downtime: 0 },
            cache: { hits: 0, misses: 0, evictions: 0, hitRatio: 0 },
            batch: { totalBatches: 0, totalBatchedRequests: 0, avgBatchSize: 0, batchProcessingTime: 0 },
            memory: { bufferSize: 0, cacheSize: 0, poolSize: 0, heapUsed: 0, heapTotal: 0 }
        };

        this.responseTimeHistory = [];
        this.methodMetrics.clear();
        this.errorHistory = [];
        this.startTime = Date.now();
        this.connectionStartTime = null;
        this.lastConnectionTime = null;
    }

    /**
     * Print formatted metrics summary
     */
    printSummary() {
        if (!this.enabled) {
            this.logger.log('📊 Metrics collection is disabled');
            return;
        }

        const metrics = this.getMetrics();
        const uptime = metrics.uptime / 1000;

        this.logger.log('\n📊 Performance Metrics Summary');
        this.logger.log('=====================================');
        this.logger.log(`🚀 Throughput: ${metrics.derived.requestsPerSecond} req/sec`);
        this.logger.log(`✅ Success Rate: ${metrics.derived.successRate}%`);
        this.logger.log(`⚡ Response Times: min=${metrics.responses.minTime}ms, avg=${metrics.responses.avgTime.toFixed(2)}ms, max=${metrics.responses.maxTime}ms`);
        this.logger.log(`📈 Percentiles: P50=${metrics.responses.p50}ms, P95=${metrics.responses.p95}ms, P99=${metrics.responses.p99}ms`);
        this.logger.log(`🔗 Connection Uptime: ${metrics.derived.connectionUptimeRatio}%`);
        this.logger.log(`💾 Cache Hit Ratio: ${metrics.cache.hitRatio}%`);
        this.logger.log(`📦 Total Requests: ${metrics.requests.total} (${metrics.requests.successful} success, ${metrics.requests.failed} failed)`);
        this.logger.log(`⏱️ Total Uptime: ${(uptime / 60).toFixed(1)} minutes`);
        
        if (metrics.recentErrors.length > 0) {
            this.logger.log(`❌ Recent Errors: ${metrics.recentErrors.length}`);
        }
        
        this.logger.log('=====================================\n');
    }

    /**
     * Enable/disable metrics collection
     * @param {boolean} enabled - Enable or disable metrics
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.reset();
        }
    }
}
