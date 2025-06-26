/**
 * High-Performance Cache Manager with LRU eviction and TTL support
 * Optimized for frequent read operations with minimal memory overhead
 */
export class CacheManager {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.defaultTTL = options.defaultTTL || 5000; // 5 seconds
        this.enabled = options.enabled !== false;
        
        // Use Map for O(1) operations with insertion order preservation
        this.cache = new Map();
        this.accessTimes = new Map();
        
        // Performance tracking
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        
        // Cleanup timer for expired entries
        this.cleanupInterval = options.cleanupInterval || 30000; // 30 seconds
        this.cleanupTimer = null;
        
        if (this.enabled) {
            this.startCleanupTimer();
        }
        
        this.logger = options.logger || console;
    }

    /**
     * Get cached value with LRU update
     * @param {string} key - Cache key
     * @returns {any|null} - Cached value or null if not found/expired
     */
    get(key) {
        if (!this.enabled) {
            this.misses++;
            return null;
        }

        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            // Entry expired
            this.cache.delete(key);
            this.accessTimes.delete(key);
            this.misses++;
            return null;
        }

        // Update access time for LRU
        this.accessTimes.set(key, now);
        
        // Move to end for LRU (delete and re-insert)
        this.cache.delete(key);
        this.cache.set(key, entry);
        
        this.hits++;
        return entry.data;
    }

    /**
     * Set cache value with TTL
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    set(key, data, ttl = this.defaultTTL) {
        if (!this.enabled) return;

        // Implement LRU eviction if at capacity
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        const now = Date.now();
        const entry = {
            data,
            timestamp: now,
            ttl
        };

        this.cache.set(key, entry);
        this.accessTimes.set(key, now);
    }

    /**
     * Evict least recently used entry
     */
    evictLRU() {
        if (this.cache.size === 0) return;

        // Find the least recently accessed key
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, accessTime] of this.accessTimes) {
            if (accessTime < oldestTime) {
                oldestTime = accessTime;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.accessTimes.delete(oldestKey);
            this.evictions++;
        }
    }

    /**
     * Check if key exists and is not expired
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        if (!this.enabled) return false;

        const entry = this.cache.get(key);
        if (!entry) return false;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete specific key
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.accessTimes.clear();
        this.logger.log('🧹 Cache cleared');
    }

    /**
     * Start cleanup timer for expired entries
     */
    startCleanupTimer() {
        if (this.cleanupTimer) return;

        this.cleanupTimer = setInterval(() => {
            this.cleanupExpired();
        }, this.cleanupInterval);
    }

    /**
     * Stop cleanup timer
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Remove expired entries
     */
    cleanupExpired() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > entry.ttl) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
        }

        if (keysToDelete.length > 0) {
            this.logger.log(`🧹 Cleaned up ${keysToDelete.length} expired cache entries`);
        }
    }

    /**
     * Get cache statistics
     * @returns {object} Cache statistics
     */
    getStats() {
        const totalRequests = this.hits + this.misses;
        const hitRatio = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

        return {
            enabled: this.enabled,
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            evictions: this.evictions,
            hitRatio: parseFloat(hitRatio.toFixed(2)),
            memoryUsage: this.getMemoryUsage()
        };
    }

    /**
     * Estimate memory usage (approximate)
     * @returns {object} Memory usage statistics
     */
    getMemoryUsage() {
        let totalSize = 0;
        let keySize = 0;
        let valueSize = 0;

        for (const [key, entry] of this.cache) {
            keySize += key.length * 2; // Approximate UTF-16 encoding
            valueSize += JSON.stringify(entry.data).length * 2;
        }

        totalSize = keySize + valueSize;

        return {
            totalBytes: totalSize,
            keyBytes: keySize,
            valueBytes: valueSize,
            entriesCount: this.cache.size
        };
    }

    /**
     * Enable/disable cache
     * @param {boolean} enabled - Enable or disable cache
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled) {
            this.startCleanupTimer();
        } else {
            this.stopCleanupTimer();
            this.clear();
        }
    }

    /**
     * Destroy cache manager and cleanup resources
     */
    destroy() {
        this.stopCleanupTimer();
        this.clear();
    }
}
