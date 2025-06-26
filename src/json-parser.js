/**
 * High-Performance JSON Parser for IPC responses
 * Optimized for streaming JSON parsing with efficient boundary detection
 */
export class JSONParser {
    constructor(options = {}) {
        this.bufferSize = options.bufferSize || 2 * 1024 * 1024; // 2MB
        this.buffer = Buffer.alloc(0);
        this.logger = options.logger || console;
        
        // Performance tracking
        this.parsedMessages = 0;
        this.parseErrors = 0;
        this.totalParseTime = 0;
        
        // Pre-compiled regex for better performance
        this.newlineRegex = /\n/g;
    }

    /**
     * Process incoming data and extract complete JSON messages
     * @param {Buffer} data - Incoming data buffer
     * @returns {Array} Array of parsed JSON objects
     */
    processData(data) {
        const startTime = Date.now();
        const results = [];

        // Protect against buffer overflow
        const newBufferSize = this.buffer.length + data.length;
        if (newBufferSize > this.bufferSize) {
            this.logger.warn(`⚠️ Buffer exceeded ${this.bufferSize} bytes. Resetting.`);
            this.buffer = Buffer.alloc(0);
            this.parseErrors++;
            return results;
        }

        // Efficiently concatenate buffers
        this.buffer = Buffer.concat([this.buffer, data], newBufferSize);

        // Fast path: Check for newline-separated JSON (common in Geth/Anvil)
        if (this.buffer.includes(0x0A)) { // newline character
            const processed = this.processNewlineSeparated();
            if (processed.length > 0) {
                results.push(...processed);
                this.updateParseMetrics(startTime, processed.length);
                return results;
            }
        }

        // Fallback: Use brace-counting method for concatenated JSON
        const processed = this.processBraceCounting();
        results.push(...processed);
        
        this.updateParseMetrics(startTime, processed.length);
        return results;
    }

    /**
     * Process newline-separated JSON messages (optimized path)
     * @returns {Array} Array of parsed JSON objects
     */
    processNewlineSeparated() {
        const results = [];
        const bufferStr = this.buffer.toString('utf8');
        const lines = bufferStr.split('\n');
        
        let processedBytes = 0;
        
        // Process all complete lines (leave last incomplete line in buffer)
        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line.length === 0) {
                processedBytes += 1; // Just the newline
                continue;
            }

            try {
                const parsed = JSON.parse(line);
                results.push(parsed);
                processedBytes += Buffer.byteLength(line, 'utf8') + 1; // +1 for newline
            } catch (error) {
                this.logger.warn('⚠️ JSON parse error:', error.message);
                this.parseErrors++;
                processedBytes += Buffer.byteLength(line, 'utf8') + 1;
            }
        }

        // Update buffer to remove processed data
        if (processedBytes > 0) {
            this.buffer = this.buffer.subarray(processedBytes);
        }

        return results;
    }

    /**
     * Process JSON using brace counting (fallback method)
     * @returns {Array} Array of parsed JSON objects
     */
    processBraceCounting() {
        const results = [];
        let offset = 0;

        while (offset < this.buffer.length) {
            const result = this.findCompleteJSON(offset);
            if (!result) break;

            const { endOffset, jsonStr } = result;
            
            try {
                const parsed = JSON.parse(jsonStr);
                results.push(parsed);
                offset = endOffset;
            } catch (error) {
                this.logger.warn('⚠️ JSON parse error:', error.message);
                this.parseErrors++;
                offset = endOffset;
            }
        }

        // Clean up processed data from buffer
        if (offset > 0) {
            this.buffer = this.buffer.subarray(offset);
        }

        return results;
    }

    /**
     * Find complete JSON object using optimized boundary detection
     * @param {number} startOffset - Starting offset in buffer
     * @returns {object|null} Object with endOffset and jsonStr, or null
     */
    findCompleteJSON(startOffset) {
        let braceCount = 0;
        let inString = false;
        let escape = false;
        let foundStart = false;
        let startPos = startOffset;

        // Skip whitespace to find JSON start
        while (startPos < this.buffer.length && this.isWhitespace(this.buffer[startPos])) {
            startPos++;
        }

        if (startPos >= this.buffer.length) return null;

        for (let i = startPos; i < this.buffer.length; i++) {
            const byte = this.buffer[i];

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
                    if (!foundStart) {
                        startPos = i;
                        foundStart = true;
                    }
                    braceCount++;
                } else if (byte === 0x7D && foundStart) { // closing brace }
                    braceCount--;
                    if (braceCount === 0) {
                        const jsonStr = this.buffer.subarray(startPos, i + 1).toString('utf8');
                        return { endOffset: i + 1, jsonStr };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Check if byte is whitespace
     * @param {number} byte - Byte value
     * @returns {boolean}
     */
    isWhitespace(byte) {
        return byte === 0x20 || // space
               byte === 0x09 || // tab
               byte === 0x0A || // newline
               byte === 0x0D;   // carriage return
    }

    /**
     * Update parsing performance metrics
     * @param {number} startTime - Parse start time
     * @param {number} messageCount - Number of messages parsed
     */
    updateParseMetrics(startTime, messageCount) {
        const parseTime = Date.now() - startTime;
        this.totalParseTime += parseTime;
        this.parsedMessages += messageCount;
    }

    /**
     * Get parser statistics
     * @returns {object} Parser performance statistics
     */
    getStats() {
        const avgParseTime = this.parsedMessages > 0 
            ? this.totalParseTime / this.parsedMessages 
            : 0;

        return {
            parsedMessages: this.parsedMessages,
            parseErrors: this.parseErrors,
            totalParseTime: this.totalParseTime,
            avgParseTime: parseFloat(avgParseTime.toFixed(2)),
            bufferSize: this.buffer.length,
            maxBufferSize: this.bufferSize,
            errorRate: this.parsedMessages > 0 
                ? parseFloat(((this.parseErrors / (this.parsedMessages + this.parseErrors)) * 100).toFixed(2))
                : 0
        };
    }

    /**
     * Reset parser state and clear buffer
     */
    reset() {
        this.buffer = Buffer.alloc(0);
        this.parsedMessages = 0;
        this.parseErrors = 0;
        this.totalParseTime = 0;
    }

    /**
     * Get current buffer size
     * @returns {number} Current buffer size in bytes
     */
    getBufferSize() {
        return this.buffer.length;
    }

    /**
     * Check if buffer has pending data
     * @returns {boolean}
     */
    hasPendingData() {
        return this.buffer.length > 0;
    }
}
