# Sumtise Deployment Guide

This guide covers deploying Sumtise to various platforms and environments.

## 🚀 Quick Start

### Local Development
```bash
# Clone the repository
git clone <repository-url>
cd sumtise

# Run setup script
chmod +x setup.sh
./setup.sh

# Start development server
npm run dev
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f app
```

## 🌐 Production Deployment

### 1. Vercel Deployment (Recommended)

Vercel is the easiest way to deploy Next.js applications:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# - DATABASE_URL
# - NEXTAUTH_SECRET
# - NEXTAUTH_URL
# - OPENAI_API_KEY (optional)
```

**Environment Variables for Vercel:**
```env
DATABASE_URL=postgresql://username:password@host:5432/sumtise
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-secret-key
OPENAI_API_KEY=your-openai-key
```

### 2. AWS Deployment

#### Using AWS App Runner
```bash
# Build Docker image
docker build -t sumtise .

# Push to ECR
aws ecr create-repository --repository-name sumtise
docker tag sumtise:latest <account>.dkr.ecr.<region>.amazonaws.com/sumtise:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/sumtise:latest

# Create App Runner service
aws apprunner create-service --cli-input-json file://apprunner-config.json
```

#### Using AWS ECS
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name sumtise-cluster

# Create task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service --cluster sumtise-cluster --service-name sumtise-service --task-definition sumtise:1 --desired-count 2
```

### 3. Google Cloud Platform

#### Using Cloud Run
```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT-ID/sumtise

# Deploy to Cloud Run
gcloud run deploy sumtise --image gcr.io/PROJECT-ID/sumtise --platform managed --region us-central1 --allow-unauthenticated
```

### 4. DigitalOcean App Platform

1. Connect your GitHub repository
2. Select "Docker" as the source type
3. Configure environment variables
4. Deploy

### 5. Self-Hosted VPS

#### Using Docker Compose
```bash
# Clone repository
git clone <repository-url>
cd sumtise

# Configure environment
cp env.example .env.local
# Edit .env.local with your values

# Start services
docker-compose up -d

# Run migrations
docker-compose exec app npm run db:migrate

# Seed database (optional)
docker-compose exec app npm run db:seed
```

#### Manual Installation
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Install Redis
sudo apt-get install redis-server

# Clone and setup
git clone <repository-url>
cd sumtise
npm install
npm run build

# Setup database
sudo -u postgres createdb sumtise
npm run db:migrate

# Start with PM2
npm install -g pm2
pm2 start npm --name "sumtise" -- start
pm2 startup
pm2 save
```

## 🗄️ Database Setup

### PostgreSQL Configuration

#### Local Development
```bash
# Install PostgreSQL
brew install postgresql  # macOS
sudo apt-get install postgresql  # Ubuntu

# Create database
sudo -u postgres createdb sumtise
sudo -u postgres createuser sumtise_user
sudo -u postgres psql -c "ALTER USER sumtise_user PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sumtise TO sumtise_user;"
```

#### Production Database Options

**1. AWS RDS**
```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier sumtise-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username sumtise \
  --master-user-password your-password \
  --allocated-storage 20
```

**2. Google Cloud SQL**
```bash
# Create Cloud SQL instance
gcloud sql instances create sumtise-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1
```

**3. DigitalOcean Managed Database**
- Create PostgreSQL cluster in DigitalOcean dashboard
- Configure connection details

**4. Supabase**
- Create project at supabase.com
- Get connection string from project settings

## 🔐 Security Configuration

### SSL/TLS Setup

#### Using Let's Encrypt (Certbot)
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Using Cloudflare
1. Add domain to Cloudflare
2. Update nameservers
3. Enable SSL/TLS encryption
4. Configure security settings

### Environment Security

```bash
# Generate secure secrets
openssl rand -base64 32  # For NEXTAUTH_SECRET
openssl rand -base64 32  # For JWT secret

# Set secure file permissions
chmod 600 .env.local
chmod 600 .env.production
```

## 📊 Monitoring & Logging

### Application Monitoring

#### Using Sentry
```bash
npm install @sentry/nextjs

# Configure in next.config.js
const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(nextConfig, {
  org: 'your-org',
  project: 'sumtise',
})
```

#### Using LogRocket
```bash
npm install logrocket

# Initialize in _app.tsx
import LogRocket from 'logrocket'
LogRocket.init('your-app-id')
```

### Database Monitoring

#### Using pgAdmin
```bash
# Install pgAdmin
sudo apt-get install pgadmin4

# Access at http://localhost/pgadmin4
```

#### Using Grafana + Prometheus
```bash
# Install Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.40.0/prometheus-2.40.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz

# Install Grafana
sudo apt-get install -y adduser libfontconfig1
wget https://dl.grafana.com/oss/release/grafana_9.3.0_amd64.deb
sudo dpkg -i grafana_9.3.0_amd64.deb
```

## 🔄 Backup & Recovery

### Database Backups

#### Automated Backups
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U sumtise_user -d sumtise > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/
```

#### Using AWS RDS Automated Backups
```bash
# Enable automated backups
aws rds modify-db-instance \
  --db-instance-identifier sumtise-db \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00"
```

### File Backups

#### Using AWS S3
```bash
# Sync uploads to S3
aws s3 sync ./public/uploads s3://your-bucket/uploads
```

## 🚀 Performance Optimization

### CDN Setup

#### Using Cloudflare
1. Add domain to Cloudflare
2. Enable caching
3. Configure page rules
4. Enable compression

#### Using AWS CloudFront
```bash
# Create CloudFront distribution
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

### Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX idx_transactions_organization_date ON transactions(organization_id, date);
CREATE INDEX idx_invoices_organization_status ON invoices(organization_id, status);
CREATE INDEX idx_customers_organization ON customers(organization_id);
```

### Caching Strategy

#### Redis Configuration
```bash
# Install Redis
sudo apt-get install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru
```

## 🔧 Maintenance

### Regular Updates

```bash
# Update dependencies
npm update

# Security audit
npm audit fix

# Database migrations
npm run db:migrate
```

### Health Checks

```bash
# Application health check
curl -f http://localhost:3000/api/health || exit 1

# Database health check
pg_isready -h localhost -p 5432 -U sumtise_user
```

## 📞 Support

For deployment issues:
- Check logs: `docker-compose logs -f app`
- Verify environment variables
- Ensure database connectivity
- Check SSL certificate validity

## 🎯 Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificate installed
- [ ] Domain DNS configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Security headers configured
- [ ] Performance optimization applied
- [ ] Error tracking enabled
- [ ] Logging configured
