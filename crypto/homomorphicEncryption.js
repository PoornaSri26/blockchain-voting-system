const crypto = require('crypto');
const { BigInteger } = require('jsbn');

/**
 * Simplified Paillier Homomorphic Encryption for vote tallying
 * This allows computation on encrypted votes without decrypting them
 */
class PaillierEncryption {
    constructor(keySize = 1024) {
        this.keySize = keySize;
        this.publicKey = null;
        this.privateKey = null;
    }

    /**
     * Generate public and private key pair
     */
    generateKeys() {
        // Generate two large primes p and q
        const p = this.generatePrime(this.keySize / 2);
        const q = this.generatePrime(this.keySize / 2);
        
        // Calculate n = p * q
        const n = p.multiply(q);
        
        // Calculate lambda = lcm(p-1, q-1)
        const lambda = this.lcm(p.subtract(BigInteger.ONE), q.subtract(BigInteger.ONE));
        
        // Calculate g = n + 1 (simplified)
        const g = n.add(BigInteger.ONE);
        
        // Calculate mu = (L(g^lambda mod n^2))^-1 mod n
        const nSquared = n.multiply(n);
        const gLambda = g.modPow(lambda, nSquared);
        const mu = this.L(gLambda, n).modInverse(n);
        
        this.publicKey = { n, g, nSquared };
        this.privateKey = { lambda, mu, n, nSquared };
        
        return {
            publicKey: this.publicKey,
            privateKey: this.privateKey
        };
    }

    /**
     * Encrypt a vote (0 or 1 for binary votes, or candidate index)
     */
    encrypt(vote, publicKey = this.publicKey) {
        if (!publicKey) {
            throw new Error('Public key not available');
        }

        const { n, g, nSquared } = publicKey;
        const m = new BigInteger(vote.toString());
        
        // Generate random r where gcd(r, n) = 1
        let r;
        do {
            r = this.generateRandom(n);
        } while (!r.gcd(n).equals(BigInteger.ONE));
        
        // Calculate ciphertext: c = g^m * r^n mod n^2
        const gm = g.modPow(m, nSquared);
        const rn = r.modPow(n, nSquared);
        const ciphertext = gm.multiply(rn).mod(nSquared);
        
        return ciphertext.toString(16);
    }

    /**
     * Decrypt a ciphertext
     */
    decrypt(ciphertext, privateKey = this.privateKey) {
        if (!privateKey) {
            throw new Error('Private key not available');
        }

        const { lambda, mu, n, nSquared } = privateKey;
        const c = new BigInteger(ciphertext, 16);
        
        // Calculate plaintext: m = L(c^lambda mod n^2) * mu mod n
        const cLambda = c.modPow(lambda, nSquared);
        const plaintext = this.L(cLambda, n).multiply(mu).mod(n);
        
        return parseInt(plaintext.toString());
    }

    /**
     * Add two encrypted votes (homomorphic addition)
     */
    addEncrypted(ciphertext1, ciphertext2, publicKey = this.publicKey) {
        if (!publicKey) {
            throw new Error('Public key not available');
        }

        const { nSquared } = publicKey;
        const c1 = new BigInteger(ciphertext1, 16);
        const c2 = new BigInteger(ciphertext2, 16);
        
        // Homomorphic addition: c1 * c2 mod n^2
        const result = c1.multiply(c2).mod(nSquared);
        
        return result.toString(16);
    }

    /**
     * Multiply encrypted vote by a constant (for weighted voting)
     */
    multiplyByConstant(ciphertext, constant, publicKey = this.publicKey) {
        if (!publicKey) {
            throw new Error('Public key not available');
        }

        const { nSquared } = publicKey;
        const c = new BigInteger(ciphertext, 16);
        const k = new BigInteger(constant.toString());
        
        // Homomorphic multiplication by constant: c^k mod n^2
        const result = c.modPow(k, nSquared);
        
        return result.toString(16);
    }

    /**
     * Batch encrypt multiple votes
     */
    batchEncrypt(votes, publicKey = this.publicKey) {
        return votes.map(vote => this.encrypt(vote, publicKey));
    }

    /**
     * Tally encrypted votes homomorphically
     */
    tallyEncryptedVotes(encryptedVotes, publicKey = this.publicKey) {
        if (encryptedVotes.length === 0) {
            return this.encrypt(0, publicKey);
        }

        let tally = encryptedVotes[0];
        for (let i = 1; i < encryptedVotes.length; i++) {
            tally = this.addEncrypted(tally, encryptedVotes[i], publicKey);
        }

        return tally;
    }

    /**
     * Generate zero-knowledge proof of correct encryption
     */
    generateEncryptionProof(vote, randomness, ciphertext, publicKey = this.publicKey) {
        // Simplified ZK proof for correct encryption
        // In production, would use proper sigma protocols
        
        const { n, g } = publicKey;
        const m = new BigInteger(vote.toString());
        const r = new BigInteger(randomness, 16);
        
        // Generate challenge
        const challenge = this.generateRandom(n);
        
        // Generate response
        const response = r.multiply(challenge).add(m);
        
        return {
            challenge: challenge.toString(16),
            response: response.toString(16),
            ciphertext: ciphertext
        };
    }

    /**
     * Verify encryption proof
     */
    verifyEncryptionProof(proof, publicKey = this.publicKey) {
        // Simplified verification
        // In production, would implement proper sigma protocol verification
        
        return proof.challenge && proof.response && proof.ciphertext;
    }

    /**
     * L function: L(x) = (x - 1) / n
     */
    L(x, n) {
        return x.subtract(BigInteger.ONE).divide(n);
    }

    /**
     * Calculate least common multiple
     */
    lcm(a, b) {
        return a.multiply(b).divide(a.gcd(b));
    }

    /**
     * Generate a random BigInteger less than n
     */
    generateRandom(n) {
        const bytes = Math.ceil(n.bitLength() / 8);
        let random;
        do {
            const randomBytes = crypto.randomBytes(bytes);
            random = new BigInteger(randomBytes.toString('hex'), 16);
        } while (random.compareTo(n) >= 0);
        
        return random;
    }

    /**
     * Generate a prime number of specified bit length
     */
    generatePrime(bitLength) {
        let prime;
        do {
            const bytes = Math.ceil(bitLength / 8);
            const randomBytes = crypto.randomBytes(bytes);
            prime = new BigInteger(randomBytes.toString('hex'), 16);
            
            // Ensure odd number
            if (prime.isEven()) {
                prime = prime.add(BigInteger.ONE);
            }
        } while (!this.isProbablePrime(prime));
        
        return prime;
    }

    /**
     * Miller-Rabin primality test
     */
    isProbablePrime(n, k = 10) {
        if (n.equals(BigInteger.valueOf(2)) || n.equals(BigInteger.valueOf(3))) {
            return true;
        }
        if (n.compareTo(BigInteger.valueOf(2)) < 0 || n.isEven()) {
            return false;
        }

        // Write n-1 as d * 2^r
        let r = 0;
        let d = n.subtract(BigInteger.ONE);
        while (d.isEven()) {
            d = d.shiftRight(1);
            r++;
        }

        // Perform k rounds of testing
        for (let i = 0; i < k; i++) {
            const a = this.generateRandom(n.subtract(BigInteger.valueOf(3))).add(BigInteger.valueOf(2));
            let x = a.modPow(d, n);

            if (x.equals(BigInteger.ONE) || x.equals(n.subtract(BigInteger.ONE))) {
                continue;
            }

            let composite = true;
            for (let j = 0; j < r - 1; j++) {
                x = x.modPow(BigInteger.valueOf(2), n);
                if (x.equals(n.subtract(BigInteger.ONE))) {
                    composite = false;
                    break;
                }
            }

            if (composite) {
                return false;
            }
        }

        return true;
    }

    /**
     * Export public key for sharing
     */
    exportPublicKey() {
        if (!this.publicKey) {
            throw new Error('No public key available');
        }

        return {
            n: this.publicKey.n.toString(16),
            g: this.publicKey.g.toString(16),
            nSquared: this.publicKey.nSquared.toString(16)
        };
    }

    /**
     * Import public key
     */
    importPublicKey(keyData) {
        this.publicKey = {
            n: new BigInteger(keyData.n, 16),
            g: new BigInteger(keyData.g, 16),
            nSquared: new BigInteger(keyData.nSquared, 16)
        };
    }
}

/**
 * ElGamal Encryption for additional cryptographic operations
 */
class ElGamalEncryption {
    constructor() {
        this.p = null; // Large prime
        this.g = null; // Generator
        this.publicKey = null;
        this.privateKey = null;
    }

    /**
     * Generate ElGamal key pair
     */
    generateKeys(bitLength = 1024) {
        // Generate large prime p
        this.p = this.generatePrime(bitLength);
        
        // Find generator g
        this.g = this.findGenerator(this.p);
        
        // Generate private key x (random)
        this.privateKey = this.generateRandom(this.p.subtract(BigInteger.ONE));
        
        // Calculate public key y = g^x mod p
        this.publicKey = this.g.modPow(this.privateKey, this.p);
        
        return {
            publicKey: {
                p: this.p.toString(16),
                g: this.g.toString(16),
                y: this.publicKey.toString(16)
            },
            privateKey: this.privateKey.toString(16)
        };
    }

    /**
     * Encrypt message using ElGamal
     */
    encrypt(message, publicKey) {
        const p = new BigInteger(publicKey.p, 16);
        const g = new BigInteger(publicKey.g, 16);
        const y = new BigInteger(publicKey.y, 16);
        const m = new BigInteger(message.toString());
        
        // Generate random k
        const k = this.generateRandom(p.subtract(BigInteger.ONE));
        
        // Calculate c1 = g^k mod p
        const c1 = g.modPow(k, p);
        
        // Calculate c2 = m * y^k mod p
        const c2 = m.multiply(y.modPow(k, p)).mod(p);
        
        return {
            c1: c1.toString(16),
            c2: c2.toString(16)
        };
    }

    /**
     * Decrypt ElGamal ciphertext
     */
    decrypt(ciphertext, privateKey) {
        const c1 = new BigInteger(ciphertext.c1, 16);
        const c2 = new BigInteger(ciphertext.c2, 16);
        const x = new BigInteger(privateKey, 16);
        
        // Calculate s = c1^x mod p
        const s = c1.modPow(x, this.p);
        
        // Calculate m = c2 * s^-1 mod p
        const sInverse = s.modInverse(this.p);
        const message = c2.multiply(sInverse).mod(this.p);
        
        return parseInt(message.toString());
    }

    /**
     * Find a generator for the multiplicative group mod p
     */
    findGenerator(p) {
        // Simplified generator finding (in production, use proper algorithm)
        for (let g = new BigInteger('2'); g.compareTo(p) < 0; g = g.add(BigInteger.ONE)) {
            if (this.isGenerator(g, p)) {
                return g;
            }
        }
        throw new Error('No generator found');
    }

    /**
     * Check if g is a generator mod p
     */
    isGenerator(g, p) {
        // Simplified check (in production, use proper primality testing)
        const order = p.subtract(BigInteger.ONE);
        return g.modPow(order, p).equals(BigInteger.ONE);
    }

    /**
     * Generate random BigInteger
     */
    generateRandom(max) {
        const bytes = Math.ceil(max.bitLength() / 8);
        let random;
        do {
            const randomBytes = crypto.randomBytes(bytes);
            random = new BigInteger(randomBytes.toString('hex'), 16);
        } while (random.compareTo(max) >= 0);
        
        return random;
    }

    /**
     * Generate prime number
     */
    generatePrime(bitLength) {
        // Reuse the prime generation from PaillierEncryption
        const paillier = new PaillierEncryption();
        return paillier.generatePrime(bitLength);
    }
}

module.exports = {
    PaillierEncryption,
    ElGamalEncryption
};
