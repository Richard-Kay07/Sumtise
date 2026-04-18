# Sumtise Operations Guide

## Table of Contents
1. [Overview](#overview)
2. [Infrastructure](#infrastructure)
3. [Deployment](#deployment)
4. [Environment Configuration](#environment-configuration)
5. [Database Management](#database-management)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup & Recovery](#backup--recovery)
8. [Security](#security)
9. [Performance](#performance)
10. [Troubleshooting](#troubleshooting)

## Overview

Sumtise is a multi-tenant accounting platform built with Next.js, tRPC, Prisma, and PostgreSQL. This guide covers operational procedures for running Sumtise in production.

### Technology Stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: tRPC, Next.js API Routes
- **Database**: PostgreSQL (via Prisma ORM)
- **Authentication**: NextAuth.js
- **Deployment**: Docker, Docker Compose
- **Testing**: Playwright

## Infrastructure

### Minimum Requirements

**Development:**
- Node.js 18+
- PostgreSQL 14+
- 4GB RAM
- 2 CPU cores

**Production:**
- Node.js 18+
- PostgreSQL 14+ (recommended: managed database)
- 8GB+ RAM
- 4+ CPU cores
- SSD storage (100GB+)

### Recommended Setup

**Development:**
```bash
# Local with Docker
docker-compose up -d

# Or local without Docker
npm run dev
```

**Production:**
- **Application**: Deploy to Vercel, AWS ECS, or Kubernetes
- **Database**: Managed PostgreSQL (AWS RDS, DigitalOcean, Supabase)
- **CDN**: Cloudflare or AWS CloudFront
- **Monitoring**: Sentry, DataDog, or New Relic

## Deployment

### Initial Setup

1. **Clone Repository**
```bash
git clone <repository-url>
cd sumtise
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure Environment**
```bash
cp env.example .env.local
# Edit .env.local with your configuration
```

4. **Database Setup**
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed demo data (optional)
npm run uat:init
```

5. **Build Application**
```bash
npm run build
```

6. **Start Application**
```bash
npm start
```

### Docker Deployment

**Build Image:**
```bash
docker build -t sumtise:latest .
```

**Run Container:**
```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="..." \
  -e NEXTAUTH_URL="https://your-domain.com" \
  sumtise:latest
```

**Docker Compose:**
```bash
docker-compose up -d
```

### Environment Variables

Required environment variables (see `env.example`):

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/sumtise"

# NextAuth
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# Optional: External Services
OPENAI_API_KEY="sk-..." # For AI features
SENDGRID_API_KEY="SG...." # For email
STRIPE_SECRET_KEY="sk_..." # For payments
```

## Database Management

### Migrations

**Create Migration:**
```bash
npm run db:migrate
```

**Apply Migrations:**
```bash
npm run db:migrate
```

**Rollback Migration:**
```bash
npx prisma migrate resolve --rolled-back <migration-name>
```

### Database Backup

**Automated Backup (Recommended):**
- Use managed database provider's automated backups
- AWS RDS: Automated daily backups
- DigitalOcean: Daily backups with 7-day retention

**Manual Backup:**
```bash
# Backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup-20240101.sql
```

### Database Maintenance

**Vacuum (PostgreSQL):**
```bash
# Connect to database
psql $DATABASE_URL

# Run VACUUM
VACUUM ANALYZE;
```

**Check Database Size:**
```sql
SELECT pg_size_pretty(pg_database_size('sumtise'));
```

### Prisma Studio

**Open Database GUI:**
```bash
npm run db:studio
```

Access at: http://localhost:5555

## Monitoring & Logging

### Application Logs

**Development:**
```bash
npm run dev
# Logs appear in console
```

**Production:**
- Next.js logs to stdout/stderr
- Configure log aggregation (ELK, CloudWatch, etc.)

### Key Metrics to Monitor

1. **Application Health**
   - API response times
   - Error rates
   - Database connection pool usage

2. **Database Performance**
   - Query execution time
   - Connection pool utilization
   - Slow query log

3. **Business Metrics**
   - Active organizations
   - Active users
   - API requests per minute
   - Invoice generation rate

### Health Checks

**Application Health Endpoint:**
```
GET /api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Error Tracking

Recommended: Integrate Sentry
```env
SENTRY_DSN="https://..."
```

## Backup & Recovery

### Backup Strategy

1. **Database Backups**
   - Daily automated backups
   - Retention: 30 days
   - Test restore monthly

2. **Application Backups**
   - Source code: Git repository
   - Environment files: Secure vault (1Password, AWS Secrets Manager)
   - User uploads: S3 with versioning

### Recovery Procedures

**Database Recovery:**
1. Identify backup to restore
2. Create new database instance (if needed)
3. Restore backup:
   ```bash
   psql $DATABASE_URL < backup.sql
   ```
4. Verify data integrity
5. Update application database URL if needed

**Application Recovery:**
1. Re-deploy from Git repository
2. Restore environment variables
3. Run database migrations if needed
4. Verify application health

## Security

### Security Checklist

- [ ] Change default `NEXTAUTH_SECRET`
- [ ] Use HTTPS in production
- [ ] Enable database SSL connections
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Regular security updates
- [ ] Two-factor authentication enabled for admin accounts

### Security Updates

**Update Dependencies:**
```bash
# Check for outdated packages
npm outdated

# Update packages
npm update

# Update security vulnerabilities
npm audit fix
```

### Access Control

- Organization-scoped guards are implemented
- All API endpoints verify organization membership
- Resource ownership is verified for all mutations

See `SECURITY_GUARDS.md` for details.

## Performance

### Optimization Checklist

- [ ] Enable Next.js production mode
- [ ] Configure CDN for static assets
- [ ] Enable database connection pooling
- [ ] Implement caching where appropriate
- [ ] Monitor slow queries
- [ ] Optimize database indexes

### Database Indexes

Key indexes are created via Prisma migrations. Additional indexes may be needed based on query patterns.

**Check Index Usage:**
```sql
SELECT * FROM pg_stat_user_indexes;
```

### Caching

- Next.js automatically caches static assets
- API routes can use Next.js cache headers
- Consider Redis for session storage at scale

## Troubleshooting

### Common Issues

**1. Database Connection Error**

**Symptoms:**
- "Error: P1001: Can't reach database server"
- Application fails to start

**Solution:**
```bash
# Check database is running
docker ps | grep postgres

# Verify connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

**2. Migration Errors**

**Symptoms:**
- "Error: Migration failed"
- Database schema out of sync

**Solution:**
```bash
# Reset database (development only!)
npx prisma migrate reset

# Or resolve manually
npx prisma migrate resolve --applied <migration-name>
```

**3. Authentication Issues**

**Symptoms:**
- Users can't log in
- Session errors

**Solution:**
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches deployment URL
- Clear browser cookies/session storage

**4. Build Errors**

**Symptoms:**
- TypeScript errors
- Build fails

**Solution:**
```bash
# Clean install
rm -rf node_modules .next
npm install
npm run build
```

**5. Performance Issues**

**Symptoms:**
- Slow API responses
- High database load

**Solution:**
- Check database query performance
- Enable slow query logging
- Review database indexes
- Consider connection pooling

### Debug Mode

**Enable Debug Logging:**
```env
DEBUG=*
NODE_ENV=development
```

### Support Contacts

- **Technical Issues**: [Your support email]
- **Database Issues**: Database administrator
- **Infrastructure**: DevOps team

## Maintenance Windows

### Regular Maintenance

**Weekly:**
- Review application logs
- Check database performance metrics
- Update dependencies if needed

**Monthly:**
- Security updates
- Database optimization (VACUUM)
- Backup verification

**Quarterly:**
- Performance review
- Capacity planning
- Security audit

## Scaling

### Horizontal Scaling

1. **Application Servers**
   - Deploy multiple Next.js instances
   - Use load balancer (AWS ALB, Cloudflare)
   - Stateless application design

2. **Database**
   - Read replicas for read-heavy workloads
   - Connection pooling (PgBouncer)
   - Consider database sharding at very large scale

### Vertical Scaling

- Increase database instance size
- Increase application server resources
- Monitor and adjust based on metrics

## Emergency Procedures

### Service Outage

1. Check application health endpoint
2. Check database connectivity
3. Review application logs
4. Check infrastructure status (if using cloud provider)
5. Rollback deployment if recent deploy
6. Restore from backup if data corruption

### Data Breach

1. Immediately revoke affected API keys
2. Force password reset for affected users
3. Review audit logs
4. Notify affected users
5. Document incident

## Additional Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [tRPC Docs](https://trpc.io/docs)
- [SECURITY_GUARDS.md](./SECURITY_GUARDS.md) - Security implementation details
- [OPTIMIZATION_AND_TESTING.md](./OPTIMIZATION_AND_TESTING.md) - Performance optimizations

