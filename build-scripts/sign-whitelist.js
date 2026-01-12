#!/usr/bin/env node
/**
 * Build Script: Sign Domain Whitelist
 *
 * Generates RSA signature for allowed-domains.json to prevent tampering
 *
 * SETUP:
 * 1. Generate key pair:
 *    openssl genrsa -out private.pem 2048
 *    openssl rsa -in private.pem -pubout -out public.pem
 *
 * 2. Store private.pem securely (NOT in git!)
 *
 * 3. Run this script before deployment:
 *    node build-scripts/sign-whitelist.js
 *
 * USAGE:
 *    npm run sign-whitelist
 *
 * Or with custom paths:
 *    PRIVATE_KEY_PATH=./keys/private.pem node build-scripts/sign-whitelist.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const WHITELIST_FILE = path.join(__dirname, '..', 'allowed-domains.json');
const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH || path.join(__dirname, 'private.pem');
const PUBLIC_KEY_PATH = process.env.PUBLIC_KEY_PATH || path.join(__dirname, 'public.pem');

console.log('🔐 Signing Domain Whitelist...\n');

// Check if files exist
if (!fs.existsSync(WHITELIST_FILE)) {
    console.error('❌ Error: allowed-domains.json not found');
    console.error('   Expected path:', WHITELIST_FILE);
    process.exit(1);
}

if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('❌ Error: Private key not found');
    console.error('   Expected path:', PRIVATE_KEY_PATH);
    console.error('\nGenerate key pair with:');
    console.error('  openssl genrsa -out private.pem 2048');
    console.error('  openssl rsa -in private.pem -pubout -out public.pem');
    process.exit(1);
}

try {
    // Load files
    const config = JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf8'));
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

    // Remove old signature if present
    const dataToSign = {
        version: config.version,
        lastUpdated: config.lastUpdated || new Date().toISOString(),
        domains: config.domains,
        patterns: config.patterns || []
    };

    // Create signature
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(JSON.stringify(dataToSign));
    const signature = sign.sign(privateKey, 'hex');

    // Add signature to config
    config.signature = signature;
    config.lastUpdated = dataToSign.lastUpdated;

    // Write signed config
    fs.writeFileSync(
        WHITELIST_FILE,
        JSON.stringify(config, null, 2),
        'utf8'
    );

    console.log('✅ Domain whitelist signed successfully!');
    console.log('   File:', WHITELIST_FILE);
    console.log('   Domains:', config.domains.length);
    console.log('   Patterns:', (config.patterns || []).length);
    console.log('   Signature:', signature.substring(0, 32) + '...');
    console.log('   Last updated:', config.lastUpdated);

    // Show public key info
    if (fs.existsSync(PUBLIC_KEY_PATH)) {
        const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
        console.log('\n📋 Next steps:');
        console.log('1. Add this meta tag to all HTML files:');
        console.log('\n<meta name="domain-whitelist-public-key" content="' +
            publicKey.replace(/\n/g, '') + '">');
        console.log('\n2. Deploy the signed allowed-domains.json');
        console.log('3. Test signature verification in browser console');
    }

} catch (error) {
    console.error('❌ Error signing whitelist:', error.message);
    process.exit(1);
}

