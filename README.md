# Sumtise - Modern Accounting Software for SMEs
<!-- Trigger rebuild with NEXT_PUBLIC_APP_URL -->

Sumtise is a comprehensive, full-stack accounting software application designed specifically for Small and Medium Enterprises (SMEs) in UK and African markets. Built with modern technologies and AI-powered features, it provides a complete solution for financial management, invoicing, expense tracking, and compliance.

## 🚀 Features

### Core Accounting Features
- **Double-Entry Bookkeeping System** - Complete chart of accounts with hierarchical structure
- **Multi-Currency Support** - Automatic exchange rate tracking and conversion
- **Real-time Trial Balance** - Live calculation of financial position
- **Audit Trail** - Complete transaction history and audit logs

### Invoicing & Payments
- **Professional Invoice Templates** - Customizable invoice designs
- **Recurring Invoices** - Automated recurring billing
- **Multi-Currency Invoicing** - Support for GBP, USD, EUR, and African currencies
- **Payment Gateway Integration** - Stripe, PayPal, M-Pesa support
- **Customer Portal** - Self-service invoice viewing and payment

### Expense Management
- **OCR Receipt Scanning** - Automatic data extraction from receipts
- **AI-Powered Categorization** - Smart expense categorization using OpenAI
- **Mileage Tracking** - GPS-integrated mileage logging
- **Approval Workflows** - Multi-level expense approval processes

### Banking Integration
- **Open Banking API** - Direct bank feed integration (UK)
- **Automated Reconciliation** - ML-powered transaction matching
- **Cash Flow Forecasting** - Predictive analytics based on historical data
- **Bank Rules Engine** - Automated categorization rules

### Financial Reporting
- **Profit & Loss Statement** - Drill-down capability with period comparisons
- **Balance Sheet** - Multi-period comparative analysis
- **Cash Flow Statement** - Direct and indirect method reporting
- **Aged Receivables/Payables** - Detailed aging analysis
- **Custom Report Builder** - Drag-and-drop report creation

### Tax Compliance
- **UK VAT Returns** - Making Tax Digital (MTD) compliance
- **South African VAT** - Provisional tax calculations
- **Kenyan VAT & PAYE** - Local tax compliance
- **Zambian Tax Reports** - Regional tax requirements
- **Automated Tax Calculations** - Real-time tax computation

### AI-Powered Features
- **Natural Language Queries** - "Show me all travel expenses over £500 last quarter"
- **Intelligent Data Extraction** - PDF/image invoice processing
- **Anomaly Detection** - Fraud prevention and unusual transaction alerts
- **Cash Flow Predictions** - Time series analysis for forecasting
- **Automated Insights** - AI-generated financial recommendations

## 🛠 Technology Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn UI** - Modern component library
- **tRPC** - End-to-end typesafe APIs
- **React Query** - Server state management
- **Recharts** - Data visualization

### Backend
- **Node.js** - JavaScript runtime
- **tRPC** - Type-safe API layer
- **Prisma ORM** - Database toolkit
- **NextAuth.js** - Authentication framework
- **PostgreSQL** - Primary database

### AI & Integrations
- **OpenAI API** - Natural language processing
- **Tesseract.js** - OCR capabilities
- **Stripe** - Payment processing
- **Open Banking APIs** - Bank integration
- **Email/SMS** - Notification services

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18+ and npm
- PostgreSQL 14+
- Git

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/sumtise.git
cd sumtise
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Copy the environment template and configure your variables:
```bash
cp env.example .env.local
```

Update the following variables in `.env.local`:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/sumtise"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# OpenAI API
OPENAI_API_KEY="your-openai-api-key"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Payment Gateways
STRIPE_PUBLIC_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
```

### 4. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
sumtise/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   ├── auth/               # Authentication pages
│   │   └── page.tsx            # Home page
│   ├── components/             # React components
│   │   ├── ui/                 # Shadcn UI components
│   │   └── providers.tsx       # Context providers
│   ├── lib/                    # Utility libraries
│   │   ├── auth.ts             # NextAuth configuration
│   │   ├── prisma.ts           # Database client
│   │   ├── trpc.ts             # tRPC configuration
│   │   └── utils.ts            # Helper functions
│   ├── server/                 # Server-side code
│   │   └── routers/            # tRPC routers
│   └── types/                  # TypeScript types
│       └── schemas.ts          # Zod schemas
├── prisma/
│   └── schema.prisma           # Database schema
├── public/                     # Static assets
└── package.json
```

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint

# Database
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema changes
npm run db:migrate      # Run migrations
npm run db:studio       # Open Prisma Studio
npm run db:seed         # Seed database
```

## 🏗 Architecture Overview

### Multi-Tenant Architecture
Sumtise implements a multi-tenant architecture where each organization's data is completely isolated. Users can belong to multiple organizations with different roles and permissions.

### Authentication & Authorization
- **NextAuth.js** for authentication with JWT tokens
- **Role-based Access Control** (RBAC) with five levels:
  - Owner: Full system access
  - Admin: Organization management
  - Accountant: Financial operations
  - Bookkeeper: Data entry and basic reporting
  - Viewer: Read-only access

### API Design
- **tRPC** for type-safe API calls
- **Zod** for runtime validation
- **Prisma** for database operations
- **Superjson** for serialization

### Database Schema
The database follows double-entry bookkeeping principles with:
- Chart of Accounts (hierarchical structure)
- Transactions (debit/credit entries)
- Customers and Vendors
- Invoices and Invoice Items
- Bank Accounts
- Reports and Analytics

## 🔐 Security Features

- **Data Encryption** - All sensitive data encrypted at rest
- **HTTPS Only** - Secure communication protocols
- **Input Validation** - Comprehensive data validation
- **SQL Injection Protection** - Prisma ORM prevents SQL injection
- **Rate Limiting** - API rate limiting for abuse prevention
- **Audit Logging** - Complete audit trail for compliance

## 🌍 Regional Compliance

### UK Compliance
- Making Tax Digital (MTD) VAT returns
- HMRC integration for tax submissions
- UK-specific chart of accounts templates

### African Market Support
- **South Africa**: VAT and provisional tax
- **Kenya**: VAT, PAYE, and NHIF calculations
- **Zambia**: Local tax compliance requirements
- **Multi-currency**: Support for local currencies

## 🤖 AI Integration

### OpenAI Integration
```typescript
// Natural language query example
const query = "Show me all travel expenses over £500 last quarter"
const result = await aiService.processQuery(query, organizationId)
```

### OCR Processing
```typescript
// Receipt scanning example
const receiptData = await ocrService.scanReceipt(imageFile)
const categorizedExpense = await aiService.categorizeExpense(receiptData)
```

## 📊 Reporting & Analytics

### Built-in Reports
- Profit & Loss Statement
- Balance Sheet
- Cash Flow Statement
- Aged Receivables Report
- Aged Payables Report
- Trial Balance
- Tax Reports (region-specific)

### Custom Reports
- Drag-and-drop report builder
- Custom date ranges
- Multiple output formats (PDF, Excel, CSV)
- Scheduled report delivery

## 🔌 Integrations

### Payment Gateways
- **Stripe** - Credit card processing
- **PayPal** - Alternative payment method
- **M-Pesa** - Mobile money (Kenya)
- **Bank Transfer** - Direct bank transfers

### Banking
- **Open Banking API** - UK bank integration
- **OFX/CSV Import** - Bank statement imports
- **Automated Reconciliation** - Transaction matching

### Third-Party Services
- **Email Services** - SMTP integration
- **SMS Services** - Notification delivery
- **Cloud Storage** - Document storage
- **Backup Services** - Data protection

## 🚀 Deployment

### Production Deployment
1. **Database Setup**: Configure PostgreSQL production database
2. **Environment Variables**: Set production environment variables
3. **Build Application**: `npm run build`
4. **Deploy**: Use your preferred hosting platform (Vercel, AWS, etc.)

### Docker Deployment
```bash
# Build Docker image
docker build -t sumtise .

# Run with Docker Compose
docker-compose up -d
```

## 📈 Performance Optimization

- **Code Splitting** - Automatic code splitting with Next.js
- **Image Optimization** - Next.js Image component
- **Caching** - Redis for session and data caching
- **CDN** - Static asset delivery
- **Database Indexing** - Optimized database queries

## 🧪 Testing

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.sumtise.com](https://docs.sumtise.com)
- **Community**: [Discord Server](https://discord.gg/sumtise)
- **Email Support**: support@sumtise.com
- **Issue Tracker**: [GitHub Issues](https://github.com/your-username/sumtise/issues)

## 🗺 Roadmap

### Q1 2024
- [ ] Mobile app (React Native)
- [ ] Advanced AI features
- [ ] Multi-language support
- [ ] Advanced reporting

### Q2 2024
- [ ] API marketplace
- [ ] Third-party integrations
- [ ] Advanced analytics
- [ ] White-label solutions

---

**Built with ❤️ for SMEs in UK and African markets**
