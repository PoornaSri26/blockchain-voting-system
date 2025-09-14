# Blockchain Voting System Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Blockchain Voting System in various environments, from local development to production.

## Prerequisites

### System Requirements

- Node.js 16+ and npm 8+
- Git
- Docker and Docker Compose (optional)
- MetaMask or compatible Web3 wallet

### Development Tools

- Hardhat for smart contract development
- Truffle for contract deployment
- React 18+ for client application
- Express.js for backend API

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/blockchain-voting-system.git
cd blockchain-voting-system
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Environment Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your specific configuration:

```env
# Blockchain Configuration
ETHEREUM_RPC_URL=http://localhost:8545
ETHEREUM_TESTNET_RPC_URL=https://goerli.infura.io/v3/YOUR_PROJECT_ID
ETHEREUM_MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=your_private_key_here
MNEMONIC=your_twelve_word_mnemonic_here

# Server Configuration
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/voting_db
REDIS_URL=redis://localhost:6379

# IPFS Configuration
IPFS_API_URL=http://localhost:5001
IPFS_GATEWAY_URL=http://localhost:8080

# Oracle Configuration
CHAINLINK_ORACLE_ADDRESS=0x...
TIME_ORACLE_ENDPOINTS=["https://worldtimeapi.org/api/timezone/UTC"]

# Identity Configuration
DID_RESOLVER_URL=https://resolver.identity.foundation
CREDENTIAL_ISSUER_DID=did:ethr:0x...

# Zero-Knowledge Configuration
ZK_CIRCUITS_PATH=./circuits
ZK_PROVING_KEY_PATH=./keys/proving_key.json
ZK_VERIFICATION_KEY_PATH=./keys/verification_key.json

# Election Configuration
DEFAULT_ELECTION_DURATION=86400
DEFAULT_REGISTRATION_PERIOD=3600
MAX_CANDIDATES_PER_ELECTION=10

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=http://localhost:3001
```

## Local Development Deployment

### 1. Start Local Blockchain

Using Hardhat:
```bash
npx hardhat node
```

Or using Ganache:
```bash
npm install -g ganache-cli
ganache-cli --deterministic --accounts 10 --host 0.0.0.0
```

### 2. Deploy Smart Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost

# Or using Truffle
truffle migrate --network development
```

### 3. Start Backend Services

```bash
# Start IPFS node (if not using external service)
ipfs daemon

# Start Redis (if using)
redis-server

# Start PostgreSQL (if using)
# Configure according to your system

# Start the backend server
npm run server
```

### 4. Start Client Application

```bash
cd client
npm start
```

The application will be available at:
- Client: http://localhost:3001
- API: http://localhost:3000
- Blockchain: http://localhost:8545

## Testnet Deployment

### 1. Configure Testnet Environment

Update `.env` with testnet configuration:

```env
NODE_ENV=testnet
ETHEREUM_RPC_URL=https://goerli.infura.io/v3/YOUR_PROJECT_ID
```

### 2. Fund Deployment Account

Ensure your deployment account has sufficient testnet ETH:
- Goerli: Use Goerli faucet
- Sepolia: Use Sepolia faucet

### 3. Deploy Contracts to Testnet

```bash
# Deploy to Goerli
npx hardhat run scripts/deploy.js --network goerli

# Or using Truffle
truffle migrate --network goerli
```

### 4. Verify Contracts

```bash
# Verify on Etherscan
npx hardhat verify --network goerli DEPLOYED_CONTRACT_ADDRESS
```

### 5. Update Client Configuration

Update client configuration with deployed contract addresses:

```javascript
// client/src/config/contracts.js
export const CONTRACT_ADDRESSES = {
  goerli: {
    votingSystem: '0x...',
    identityRegistry: '0x...',
    zkProofs: '0x...'
  }
};
```

## Production Deployment

### 1. Infrastructure Setup

#### Option A: Cloud Deployment (AWS/GCP/Azure)

**EC2/Compute Engine Setup:**
```bash
# Create instance with Ubuntu 20.04+
# Install Node.js, Docker, and dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y docker.io docker-compose
```

**Database Setup:**
- Use managed PostgreSQL (RDS/Cloud SQL)
- Use managed Redis (ElastiCache/Memory Store)

**Load Balancer:**
- Configure Application Load Balancer
- Set up SSL certificates
- Configure health checks

#### Option B: Docker Deployment

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - db
      - redis

  client:
    build: ./client
    ports:
      - "80:80"
    depends_on:
      - app

  db:
    image: postgres:14
    environment:
      POSTGRES_DB: voting_db
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  ipfs:
    image: ipfs/go-ipfs:latest
    ports:
      - "4001:4001"
      - "5001:5001"
      - "8080:8080"
    volumes:
      - ipfs_data:/data/ipfs

volumes:
  postgres_data:
  redis_data:
  ipfs_data:
```

Deploy with:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Security Configuration

#### SSL/TLS Setup

```bash
# Using Let's Encrypt with Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

#### Firewall Configuration

```bash
# Configure UFW
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

#### Environment Security

- Use AWS Secrets Manager or similar for sensitive data
- Implement proper key rotation
- Use IAM roles instead of hardcoded credentials

### 3. Monitoring and Logging

#### Application Monitoring

```javascript
// Add to server/index.js
const prometheus = require('prom-client');
const collectDefaultMetrics = prometheus.collectDefaultMetrics;
collectDefaultMetrics();

app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});
```

#### Log Management

```javascript
// Configure Winston for production logging
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 4. Backup and Recovery

#### Database Backups

```bash
# Automated PostgreSQL backups
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > $BACKUP_DIR/backup_$DATE.sql
```

#### Smart Contract Backup

- Store deployment artifacts in version control
- Maintain contract verification on Etherscan
- Keep deployment transaction hashes

## CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # Add deployment commands here
          echo "Deploying to production..."
```

## Health Checks and Monitoring

### Health Check Endpoints

```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      blockchain: await checkBlockchain(),
      ipfs: await checkIPFS(),
      redis: await checkRedis()
    }
  };
  
  const isHealthy = Object.values(health.services).every(service => service.status === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### Monitoring Alerts

Set up alerts for:
- Application downtime
- High error rates
- Database connection issues
- Blockchain network issues
- High memory/CPU usage

## Scaling Considerations

### Horizontal Scaling

- Use load balancers for multiple app instances
- Implement session management with Redis
- Use CDN for static assets

### Database Scaling

- Read replicas for query optimization
- Connection pooling
- Database sharding if needed

### Blockchain Scaling

- Multiple RPC endpoints for redundancy
- Implement retry logic for failed transactions
- Use event indexing for faster queries

## Troubleshooting

### Common Issues

1. **Contract Deployment Fails**
   - Check gas limits and prices
   - Verify account has sufficient funds
   - Check network connectivity

2. **Client Can't Connect to Contracts**
   - Verify contract addresses in client config
   - Check network configuration
   - Ensure MetaMask is on correct network

3. **API Errors**
   - Check environment variables
   - Verify database connections
   - Check service dependencies

### Debug Commands

```bash
# Check contract deployment
npx hardhat verify --network mainnet CONTRACT_ADDRESS

# Check API health
curl http://localhost:3000/health

# Check logs
docker-compose logs -f app

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"
```

## Security Checklist

- [ ] Environment variables secured
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules implemented
- [ ] Database access restricted
- [ ] API rate limiting enabled
- [ ] Input validation implemented
- [ ] Audit logs configured
- [ ] Backup procedures tested
- [ ] Monitoring alerts configured
- [ ] Security headers implemented

## Maintenance

### Regular Tasks

- Update dependencies monthly
- Review and rotate secrets quarterly
- Monitor and optimize database performance
- Review access logs for suspicious activity
- Test backup and recovery procedures

### Updates and Upgrades

- Test all updates in staging environment first
- Implement blue-green deployment for zero downtime
- Maintain rollback procedures
- Document all changes

## Support and Resources

- **Documentation**: [Full Documentation](https://docs.blockchain-voting.com)
- **GitHub**: [Repository](https://github.com/your-org/blockchain-voting-system)
- **Support**: support@blockchain-voting.com
- **Community**: [Discord/Slack Channel]
