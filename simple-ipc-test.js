#!/usr/bin/env node

import { IPCProvider } from './src/ipc-provider.js';

async function simpleTest() {
    console.log('Simple IPC test...');
    
    const provider = new IPCProvider('/home/chain/exec/geth.ipc');
    
    try {
        const result = await provider.request({
            method: 'eth_chainId',
            params: []
        });
        console.log('Chain ID:', result);
        console.log('✅ IPC connection successful!');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

simpleTest();
