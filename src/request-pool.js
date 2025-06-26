/**
 * High-Performance Request Object Pool
 * Optimized memory management for JSON-RPC request objects
 */
export class RequestPool {
    constructor(options = {}) {
        this.poolSize = options.poolSize || 100;
        this.maxPoolSize = options.maxPoolSize || 500;
        this.growthFactor = options.growthFactor || 1.5;
        
        // Object pools
        this.requestPool = [];
        this.timeoutPool = [];
        
        // Pool statistics
        this.stats = {
            created: 0,
            reused: 0,
            destroyed: 0,
            currentSize: 0,
            maxSizeReached: 0,
            poolHits: 0,
            poolMisses: 0
        };
        
        // Initialize pool
        this.initializePool();
        
        this.logger = options.logger || console;
    }

    /**
     * Initialize the object pool with default objects
     */
    initializePool() {
        for (let i = 0; i < this.poolSize; i++) {
            this.requestPool.push(this.createRequestObject());
            this.timeoutPool.push(this.createTimeoutObject());
        }
        this.stats.currentSize = this.poolSize;
        this.stats.created = this.poolSize * 2; // requests + timeouts
    }

    /**
     * Create a new request object template
     * @returns {object} Clean request object
     */
    createRequestObject() {
        return {
            id: null,
            jsonrpc: '2.0',
            method: null,
            params: null,
            // Metadata for internal use
            _pooled: true,
            _timestamp: null,
            _priority: 'normal'
        };
    }

    /**
     * Create a new timeout object template
     * @returns {object} Clean timeout tracking object
     */
    createTimeoutObject() {
        return {
            timeoutId: null,
            requestId: null,
            startTime: null,
            duration: null,
            callback: null,
            _pooled: true
        };
    }

    /**
     * Get a request object from the pool
     * @param {string} id - Request ID
     * @param {string} method - RPC method
     * @param {Array} params - Method parameters
     * @param {string} priority - Request priority
     * @returns {object} Request object
     */
    getRequest(id, method, params = [], priority = 'normal') {
        let request;

        if (this.requestPool.length > 0) {
            request = this.requestPool.pop();
            this.stats.poolHits++;
            this.stats.reused++;
        } else {
            // Pool exhausted, create new object
            request = this.createRequestObject();
            this.stats.poolMisses++;
            this.stats.created++;
            
            // Consider growing the pool
            this.considerPoolGrowth();
        }

        // Initialize request object
        request.id = id;
        request.method = method;
        request.params = params;
        request._timestamp = Date.now();
        request._priority = priority;

        return request;
    }

    /**
     * Return a request object to the pool
     * @param {object} request - Request object to return
     */
    returnRequest(request) {
        if (!request || !request._pooled) {
            return; // Not a pooled object
        }

        // Clean the object
        request.id = null;
        request.method = null;
        request.params = null;
        request._timestamp = null;
        request._priority = 'normal';

        // Return to pool if there's space
        if (this.requestPool.length < this.maxPoolSize) {
            this.requestPool.push(request);
        } else {
            // Pool is full, let it be garbage collected
            this.stats.destroyed++;
        }
    }

    /**
     * Get a timeout tracking object from the pool
     * @param {string} requestId - Associated request ID
     * @param {number} duration - Timeout duration in ms
     * @param {Function} callback - Timeout callback
     * @returns {object} Timeout tracking object
     */
    getTimeout(requestId, duration, callback) {
        let timeout;

        if (this.timeoutPool.length > 0) {
            timeout = this.timeoutPool.pop();
            this.stats.poolHits++;
            this.stats.reused++;
        } else {
            timeout = this.createTimeoutObject();
            this.stats.poolMisses++;
            this.stats.created++;
        }

        // Initialize timeout object
        timeout.requestId = requestId;
        timeout.startTime = Date.now();
        timeout.duration = duration;
        timeout.callback = callback;

        return timeout;
    }

    /**
     * Return a timeout object to the pool
     * @param {object} timeout - Timeout object to return
     */
    returnTimeout(timeout) {
        if (!timeout || !timeout._pooled) {
            return;
        }

        // Clean the object
        timeout.timeoutId = null;
        timeout.requestId = null;
        timeout.startTime = null;
        timeout.duration = null;
        timeout.callback = null;

        // Return to pool if there's space
        if (this.timeoutPool.length < this.maxPoolSize) {
            this.timeoutPool.push(timeout);
        } else {
            this.stats.destroyed++;
        }
    }

    /**
     * Consider growing the pool if needed
     */
    considerPoolGrowth() {
        const currentTotal = this.requestPool.length + this.timeoutPool.length;
        
        if (currentTotal === 0 && this.stats.currentSize < this.maxPoolSize) {
            const growthSize = Math.min(
                Math.floor(this.stats.currentSize * (this.growthFactor - 1)),
                this.maxPoolSize - this.stats.currentSize
            );

            if (growthSize > 0) {
                this.logger.log(`📈 Growing object pool by ${growthSize} objects`);
                
                for (let i = 0; i < growthSize; i++) {
                    this.requestPool.push(this.createRequestObject());
                    this.timeoutPool.push(this.createTimeoutObject());
                }
                
                this.stats.currentSize += growthSize;
                this.stats.created += growthSize * 2;
                
                if (this.stats.currentSize >= this.maxPoolSize) {
                    this.stats.maxSizeReached++;
                }
            }
        }
    }

    /**
     * Shrink the pool to reduce memory usage
     * @param {number} targetSize - Target pool size (optional)
     */
    shrinkPool(targetSize = this.poolSize) {
        const currentSize = this.requestPool.length + this.timeoutPool.length;
        const shrinkAmount = Math.max(0, currentSize - targetSize);
        
        if (shrinkAmount === 0) return;

        let removed = 0;
        
        // Remove from request pool
        while (this.requestPool.length > targetSize / 2 && removed < shrinkAmount) {
            this.requestPool.pop();
            removed++;
            this.stats.destroyed++;
        }
        
        // Remove from timeout pool
        while (this.timeoutPool.length > targetSize / 2 && removed < shrinkAmount) {
            this.timeoutPool.pop();
            removed++;
            this.stats.destroyed++;
        }
        
        this.stats.currentSize -= removed;
        this.logger.log(`📉 Shrunk object pool by ${removed} objects`);
    }

    /**
     * Get pool statistics
     * @returns {object} Pool statistics
     */
    getStats() {
        const totalRequests = this.stats.poolHits + this.stats.poolMisses;
        const hitRatio = totalRequests > 0 ? (this.stats.poolHits / totalRequests) * 100 : 0;
        
        return {
            ...this.stats,
            requestPoolSize: this.requestPool.length,
            timeoutPoolSize: this.timeoutPool.length,
            totalPoolSize: this.requestPool.length + this.timeoutPool.length,
            hitRatio: parseFloat(hitRatio.toFixed(2)),
            efficiency: {
                reuseRatio: this.stats.created > 0 ? (this.stats.reused / this.stats.created) * 100 : 0,
                wasteRatio: this.stats.created > 0 ? (this.stats.destroyed / this.stats.created) * 100 : 0
            }
        };
    }

    /**
     * Optimize pool based on usage patterns
     */
    optimize() {
        const stats = this.getStats();
        
        // If hit ratio is low, consider growing the pool
        if (stats.hitRatio < 80 && this.stats.currentSize < this.maxPoolSize) {
            this.considerPoolGrowth();
        }
        
        // If pools are mostly full and hit ratio is high, consider shrinking
        else if (stats.hitRatio > 95 && stats.totalPoolSize > this.poolSize * 1.5) {
            this.shrinkPool(Math.max(this.poolSize, stats.totalPoolSize * 0.8));
        }
    }

    /**
     * Clear all pools and reset statistics
     */
    clear() {
        this.requestPool = [];
        this.timeoutPool = [];
        
        this.stats = {
            created: 0,
            reused: 0,
            destroyed: 0,
            currentSize: 0,
            maxSizeReached: 0,
            poolHits: 0,
            poolMisses: 0
        };
        
        // Reinitialize with base pool size
        this.initializePool();
    }

    /**
     * Validate pool integrity (for debugging)
     * @returns {object} Validation results
     */
    validatePool() {
        const issues = [];
        
        // Check request pool
        for (let i = 0; i < this.requestPool.length; i++) {
            const req = this.requestPool[i];
            if (!req._pooled) {
                issues.push(`Request pool item ${i} missing _pooled flag`);
            }
            if (req.id !== null || req.method !== null || req.params !== null) {
                issues.push(`Request pool item ${i} not properly cleaned`);
            }
        }
        
        // Check timeout pool
        for (let i = 0; i < this.timeoutPool.length; i++) {
            const timeout = this.timeoutPool[i];
            if (!timeout._pooled) {
                issues.push(`Timeout pool item ${i} missing _pooled flag`);
            }
            if (timeout.requestId !== null || timeout.callback !== null) {
                issues.push(`Timeout pool item ${i} not properly cleaned`);
            }
        }
        
        return {
            valid: issues.length === 0,
            issues,
            requestPoolSize: this.requestPool.length,
            timeoutPoolSize: this.timeoutPool.length
        };
    }

    /**
     * Destroy the pool and cleanup resources
     */
    destroy() {
        this.requestPool = [];
        this.timeoutPool = [];
        this.stats.destroyed += this.stats.currentSize;
        this.stats.currentSize = 0;
    }
}
