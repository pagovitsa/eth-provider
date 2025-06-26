import net from 'net';
import { EventEmitter } from 'events';

/**
 * Optimized Connection Manager for IPC communication
 * Handles connection lifecycle, reconnection, and socket optimization
 */
export class ConnectionManager extends EventEmitter {
    constructor(ipcPath, options = {}) {
        super();
        this.ipcPath = ipcPath;
        this.socket = null;
        this.isConnected = false;
        this.isReconnecting = false;
        this.isDisconnecting = false;
        
        // Reconnection configuration
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.maxRetryDelay = options.maxRetryDelay || 10000;
        this.backoffMultiplier = options.backoffMultiplier || 2;
        this.autoReconnect = options.autoReconnect !== false;
        this.currentRetries = 0;
        
        // Socket optimization settings
        this.socketTimeout = options.socketTimeout || 30000;
        this.keepAlive = options.keepAlive !== false;
        this.keepAliveInitialDelay = options.keepAliveInitialDelay || 60000;
        
        this.logger = options.logger || console;
    }

    async connect() {
        if (this.isConnected || this.isReconnecting) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.logger.log(`🔌 Connecting to IPC at: ${this.ipcPath}`);

            this.socket = net.connect(this.ipcPath);
            
            // Socket performance optimizations
            this.socket.setNoDelay(true); // Disable Nagle's algorithm
            this.socket.setTimeout(this.socketTimeout);
            
            if (this.keepAlive) {
                this.socket.setKeepAlive(true, this.keepAliveInitialDelay);
            }

            this.socket.on('connect', () => {
                this.logger.log('✅ Connected to IPC socket');
                this.isConnected = true;
                this.currentRetries = 0;
                this.isReconnecting = false;
                this.emit('connected');
                resolve();
            });

            this.socket.on('error', (error) => {
                this.logger.error('❌ IPC connection error:', error.message);
                this.isConnected = false;
                this.emit('error', error);
                reject(error);
            });

            this.socket.on('close', () => {
                this.logger.log('🔌 IPC connection closed');
                this.isConnected = false;
                this.emit('disconnected');

                if (this.autoReconnect && !this.isReconnecting && !this.isDisconnecting) {
                    this.attemptReconnect();
                }
            });

            this.socket.on('data', (data) => {
                this.emit('data', data);
            });

            this.socket.on('end', () => {
                this.logger.warn('🔚 Socket ended by server');
                this.isConnected = false;
                this.emit('disconnected');
                
                if (this.autoReconnect && !this.isReconnecting && !this.isDisconnecting) {
                    this.attemptReconnect();
                }
            });

            this.socket.on('timeout', () => {
                this.logger.warn('⏱️ Socket timeout');
                this.emit('timeout');
                
                if (this.autoReconnect && !this.isReconnecting && !this.isDisconnecting) {
                    this.attemptReconnect();
                }
            });
        });
    }

    async attemptReconnect() {
        if (this.isReconnecting || this.isDisconnecting) {
            return;
        }

        this.isReconnecting = true;
        this.emit('reconnecting');

        let currentDelay = this.retryDelay;

        while (this.currentRetries < this.maxRetries && this.autoReconnect && !this.isDisconnecting) {
            this.currentRetries++;
            this.logger.log(`🔄 Reconnecting... (${this.currentRetries}/${this.maxRetries})`);

            try {
                await new Promise(resolve => setTimeout(resolve, currentDelay));
                await this.connect();
                this.logger.log('✅ Reconnection successful!');
                this.emit('reconnected');
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
                    this.emit('maxRetriesReached');
                    break;
                }
            }
        }

        this.isReconnecting = false;
    }

    write(data) {
        if (!this.isConnected || !this.socket) {
            throw new Error('Socket not connected');
        }
        
        return this.socket.write(data);
    }

    async disconnect() {
        this.logger.log('Disconnecting from IPC');
        
        this.autoReconnect = false;
        this.isReconnecting = false;
        this.isDisconnecting = true;

        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }

        this.isConnected = false;
        this.emit('disconnected');
        this.logger.log('✅ Disconnected successfully');
    }

    getStatus() {
        return {
            connected: this.isConnected,
            reconnecting: this.isReconnecting,
            disconnecting: this.isDisconnecting,
            retries: this.currentRetries,
            maxRetries: this.maxRetries
        };
    }
}
