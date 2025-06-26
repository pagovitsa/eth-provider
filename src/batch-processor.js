/**
 * High-Performance Batch Processor for JSON-RPC requests
 * Optimized for throughput with intelligent batching and priority handling
 */
export class BatchProcessor {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 10;
        this.batchTimeout = options.batchTimeout || 10; // ms
        this.maxConcurrentBatches = options.maxConcurrentBatches || 5;
        this.enabled = options.enabled || false;
        
        // Request queues with priority support
        this.highPriorityQueue = [];
        this.normalPriorityQueue = [];
        this.lowPriorityQueue = [];
        
        // Batch management
        this.activeBatches = new Set();
        this.batchTimer = null;
        this.batchCounter = 0;
        
        // Performance tracking
        this.totalBatches = 0;
        this.totalRequests = 0;
        this.avgBatchSize = 0;
        this.batchProcessingTime = 0;
        
        // Request deduplication
        this.pendingRequests = new Map(); // method+params -> promise
        this.deduplicationEnabled = options.deduplicationEnabled !== false;
        
        this.logger = options.logger || console;
    }

    /**
     * Add request to batch queue with priority
     * @param {object} request - Request object
     * @param {string} priority - Priority level: 'high', 'normal', 'low'
     * @returns {Promise} Promise that resolves with the response
     */
    addRequest(request, priority = 'normal') {
        if (!this.enabled) {
            // If batching is disabled, return a promise that will be resolved externally
            return new Promise((resolve, reject) => {
                request.resolve = resolve;
                request.reject = reject;
                this.processSingleRequest(request);
            });
        }

        // Check for duplicate requests if deduplication is enabled
        if (this.deduplicationEnabled) {
            const requestKey = this.getRequestKey(request);
            if (this.pendingRequests.has(requestKey)) {
                return this.pendingRequests.get(requestKey);
            }
        }

        return new Promise((resolve, reject) => {
            const batchItem = {
                ...request,
                resolve,
                reject,
                priority,
                timestamp: Date.now()
            };

            // Add to appropriate priority queue
            switch (priority) {
                case 'high':
                    this.highPriorityQueue.push(batchItem);
                    break;
                case 'low':
                    this.lowPriorityQueue.push(batchItem);
                    break;
                default:
                    this.normalPriorityQueue.push(batchItem);
            }

            // Track for deduplication
            if (this.deduplicationEnabled) {
                const requestKey = this.getRequestKey(request);
                this.pendingRequests.set(requestKey, batchItem.resolve);
            }

            // Process batch if conditions are met
            this.checkBatchConditions();
        });
    }

    /**
     * Generate unique key for request deduplication
     * @param {object} request - Request object
     * @returns {string} Unique request key
     */
    getRequestKey(request) {
        return `${request.method}:${JSON.stringify(request.params || [])}`;
    }

    /**
     * Check if batch should be processed
     */
    checkBatchConditions() {
        const totalQueueSize = this.getTotalQueueSize();
        
        // Process immediately if batch size reached or high priority requests exist
        if (totalQueueSize >= this.batchSize || this.highPriorityQueue.length > 0) {
            this.processBatch();
        } else if (totalQueueSize > 0 && !this.batchTimer) {
            // Set timer for partial batch
            this.batchTimer = setTimeout(() => {
                this.processBatch();
                this.batchTimer = null;
            }, this.batchTimeout);
        }
    }

    /**
     * Get total number of queued requests
     * @returns {number} Total queue size
     */
    getTotalQueueSize() {
        return this.highPriorityQueue.length + 
               this.normalPriorityQueue.length + 
               this.lowPriorityQueue.length;
    }

    /**
     * Process batch with priority ordering
     */
    async processBatch() {
        if (this.activeBatches.size >= this.maxConcurrentBatches) {
            // Too many concurrent batches, defer processing
            setTimeout(() => this.processBatch(), 5);
            return;
        }

        // Clear timer if set
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        // Collect requests with priority ordering
        const batch = this.collectBatchRequests();
        if (batch.length === 0) return;

        const batchId = ++this.batchCounter;
        this.activeBatches.add(batchId);

        const startTime = Date.now();

        try {
            // Create JSON-RPC batch request
            const batchRequest = batch.map(item => ({
                id: item.id,
                jsonrpc: '2.0',
                method: item.method,
                params: item.params || []
            }));

            // Emit batch for processing by the main provider
            this.emit('batchReady', {
                batchId,
                requests: batchRequest,
                items: batch
            });

            // Update metrics
            this.updateBatchMetrics(batch.length, Date.now() - startTime);

        } catch (error) {
            // Reject all batch items on error
            batch.forEach(item => {
                if (item.timeout) clearTimeout(item.timeout);
                item.reject(error);
                this.cleanupDeduplication(item);
            });
        } finally {
            this.activeBatches.delete(batchId);
        }
    }

    /**
     * Collect requests for batch processing with priority ordering
     * @returns {Array} Array of batch items
     */
    collectBatchRequests() {
        const batch = [];
        let remaining = this.batchSize;

        // Process high priority first
        while (remaining > 0 && this.highPriorityQueue.length > 0) {
            batch.push(this.highPriorityQueue.shift());
            remaining--;
        }

        // Then normal priority
        while (remaining > 0 && this.normalPriorityQueue.length > 0) {
            batch.push(this.normalPriorityQueue.shift());
            remaining--;
        }

        // Finally low priority
        while (remaining > 0 && this.lowPriorityQueue.length > 0) {
            batch.push(this.lowPriorityQueue.shift());
            remaining--;
        }

        return batch;
    }

    /**
     * Handle batch response
     * @param {number} batchId - Batch identifier
     * @param {Array} responses - Array of responses
     * @param {Array} items - Original batch items
     */
    handleBatchResponse(batchId, responses, items) {
        if (!this.activeBatches.has(batchId)) {
            this.logger.warn(`⚠️ Received response for unknown batch ${batchId}`);
            return;
        }

        // Create response map for efficient lookup
        const responseMap = new Map();
        responses.forEach(response => {
            if (response.id) {
                responseMap.set(response.id, response);
            }
        });

        // Resolve/reject individual requests
        items.forEach(item => {
            const response = responseMap.get(item.id);
            
            if (response) {
                if (response.error) {
                    item.reject(new Error(response.error.message));
                } else {
                    item.resolve(response.result);
                }
            } else {
                item.reject(new Error('No response received for request'));
            }

            // Cleanup
            if (item.timeout) clearTimeout(item.timeout);
            this.cleanupDeduplication(item);
        });

        this.activeBatches.delete(batchId);
    }

    /**
     * Process single request (when batching is disabled)
     * @param {object} request - Request object
     */
    processSingleRequest(request) {
        // Emit single request for processing
        this.emit('singleRequest', request);
    }

    /**
     * Cleanup deduplication tracking
     * @param {object} item - Batch item
     */
    cleanupDeduplication(item) {
        if (this.deduplicationEnabled) {
            const requestKey = this.getRequestKey(item);
            this.pendingRequests.delete(requestKey);
        }
    }

    /**
     * Update batch processing metrics
     * @param {number} batchSize - Size of processed batch
     * @param {number} processingTime - Time taken to process batch
     */
    updateBatchMetrics(batchSize, processingTime) {
        this.totalBatches++;
        this.totalRequests += batchSize;
        this.avgBatchSize = this.totalRequests / this.totalBatches;
        this.batchProcessingTime += processingTime;
    }

    /**
     * Get batch processor statistics
     * @returns {object} Batch processing statistics
     */
    getStats() {
        const avgProcessingTime = this.totalBatches > 0 
            ? this.batchProcessingTime / this.totalBatches 
            : 0;

        return {
            enabled: this.enabled,
            totalBatches: this.totalBatches,
            totalRequests: this.totalRequests,
            avgBatchSize: parseFloat(this.avgBatchSize.toFixed(2)),
            avgProcessingTime: parseFloat(avgProcessingTime.toFixed(2)),
            activeBatches: this.activeBatches.size,
            queueSizes: {
                high: this.highPriorityQueue.length,
                normal: this.normalPriorityQueue.length,
                low: this.lowPriorityQueue.length,
                total: this.getTotalQueueSize()
            },
            deduplicationEnabled: this.deduplicationEnabled,
            pendingDeduplications: this.pendingRequests.size
        };
    }

    /**
     * Clear all queues and reset state
     */
    clear() {
        // Reject all pending requests
        const allItems = [
            ...this.highPriorityQueue,
            ...this.normalPriorityQueue,
            ...this.lowPriorityQueue
        ];

        allItems.forEach(item => {
            item.reject(new Error('Batch processor cleared'));
            if (item.timeout) clearTimeout(item.timeout);
        });

        // Clear queues
        this.highPriorityQueue = [];
        this.normalPriorityQueue = [];
        this.lowPriorityQueue = [];
        
        // Clear timers
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        // Clear deduplication
        this.pendingRequests.clear();
        this.activeBatches.clear();
    }

    /**
     * Enable/disable batch processing
     * @param {boolean} enabled - Enable or disable batching
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            // Process any remaining batches immediately
            while (this.getTotalQueueSize() > 0) {
                this.processBatch();
            }
        }
    }

    /**
     * Destroy batch processor and cleanup resources
     */
    destroy() {
        this.clear();
    }
}

// Make BatchProcessor an EventEmitter
import { EventEmitter } from 'events';
Object.setPrototypeOf(BatchProcessor.prototype, EventEmitter.prototype);
