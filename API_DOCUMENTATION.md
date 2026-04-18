# Sumtise API Documentation

## Overview

Sumtise provides a comprehensive REST API built with tRPC for type-safe client-server communication. All API endpoints are automatically typed and validated using Zod schemas.

## Base URL

- **Development**: `http://localhost:3000/api/trpc`
- **Production**: `https://your-domain.com/api/trpc`

## Authentication

All API requests require authentication using NextAuth.js JWT tokens.

### Headers
```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

## API Endpoints

### Authentication

#### Get Session
```http
GET /api/trpc/auth.getSession
```

**Response:**
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### Organizations

#### Create Organization
```http
POST /api/trpc/organization.create
```

**Request Body:**
```json
{
  "name": "Company Name",
  "slug": "company-slug",
  "website": "https://company.com",
  "email": "info@company.com",
  "phone": "+44 20 7123 4567"
}
```

**Response:**
```json
{
  "id": "org_id",
  "name": "Company Name",
  "slug": "company-slug",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### Get User Organizations
```http
GET /api/trpc/organization.getUserOrganizations
```

**Response:**
```json
[
  {
    "id": "org_id",
    "name": "Company Name",
    "slug": "company-slug"
  }
]
```

### Chart of Accounts

#### Get All Accounts
```http
GET /api/trpc/chartOfAccounts.getAll?organizationId=org_id
```

**Response:**
```json
[
  {
    "id": "account_id",
    "code": "1000",
    "name": "Current Assets",
    "type": "ASSET",
    "parentId": null,
    "isActive": true
  }
]
```

#### Create Account
```http
POST /api/trpc/chartOfAccounts.create
```

**Request Body:**
```json
{
  "organizationId": "org_id",
  "code": "1000",
  "name": "Current Assets",
  "type": "ASSET",
  "parentId": null
}
```

### Transactions

#### Get All Transactions
```http
GET /api/trpc/transactions.getAll?organizationId=org_id&page=1&limit=10
```

**Query Parameters:**
- `organizationId` (required): Organization ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `accountId` (optional): Filter by account ID
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

**Response:**
```json
{
  "transactions": [
    {
      "id": "transaction_id",
      "date": "2024-01-01T00:00:00Z",
      "description": "Transaction description",
      "debit": 1000.00,
      "credit": 0.00,
      "currency": "GBP",
      "account": {
        "name": "Cash Account",
        "code": "1100"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

#### Create Transaction
```http
POST /api/trpc/transactions.create
```

**Request Body:**
```json
{
  "organizationId": "org_id",
  "accountId": "account_id",
  "date": "2024-01-01T00:00:00Z",
  "description": "Transaction description",
  "debit": 1000.00,
  "credit": 0.00,
  "currency": "GBP"
}
```

#### Create Double Entry Transaction
```http
POST /api/trpc/transactions.createDoubleEntry
```

**Request Body:**
```json
{
  "organizationId": "org_id",
  "date": "2024-01-01T00:00:00Z",
  "description": "Double entry transaction",
  "reference": "REF-001",
  "entries": [
    {
      "accountId": "account_1",
      "debit": 1000.00,
      "credit": 0.00
    },
    {
      "accountId": "account_2",
      "debit": 0.00,
      "credit": 1000.00
    }
  ],
  "currency": "GBP"
}
```

### Customers

#### Get All Customers
```http
GET /api/trpc/customers.getAll?organizationId=org_id&page=1&limit=10
```

**Response:**
```json
{
  "customers": [
    {
      "id": "customer_id",
      "name": "Customer Name",
      "email": "customer@example.com",
      "phone": "+44 20 7123 4567",
      "creditLimit": 50000.00,
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

#### Create Customer
```http
POST /api/trpc/customers.create
```

**Request Body:**
```json
{
  "organizationId": "org_id",
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+44 20 7123 4567",
  "address": {
    "street": "123 Street",
    "city": "London",
    "postcode": "SW1A 1AA",
    "country": "United Kingdom"
  },
  "creditLimit": 50000.00
}
```

### Invoices

#### Get All Invoices
```http
GET /api/trpc/invoices.getAll?organizationId=org_id&page=1&limit=10
```

**Query Parameters:**
- `organizationId` (required): Organization ID
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status (DRAFT, SENT, PAID, OVERDUE, CANCELLED)

**Response:**
```json
{
  "invoices": [
    {
      "id": "invoice_id",
      "invoiceNumber": "INV-2024001",
      "date": "2024-01-01T00:00:00Z",
      "dueDate": "2024-01-31T00:00:00Z",
      "status": "SENT",
      "subtotal": 1000.00,
      "taxAmount": 200.00,
      "total": 1200.00,
      "currency": "GBP",
      "customer": {
        "name": "Customer Name"
      },
      "items": [
        {
          "description": "Product/Service",
          "quantity": 1,
          "unitPrice": 1000.00,
          "total": 1000.00,
          "taxRate": 20.00
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

#### Create Invoice
```http
POST /api/trpc/invoices.create
```

**Request Body:**
```json
{
  "organizationId": "org_id",
  "customerId": "customer_id",
  "date": "2024-01-01T00:00:00Z",
  "dueDate": "2024-01-31T00:00:00Z",
  "notes": "Payment terms: Net 30",
  "items": [
    {
      "description": "Product/Service",
      "quantity": 1,
      "unitPrice": 1000.00,
      "taxRate": 20.00
    }
  ]
}
```

### Bank Accounts

#### Get All Bank Accounts
```http
GET /api/trpc/bankAccounts.getAll?organizationId=org_id
```

**Response:**
```json
[
  {
    "id": "bank_account_id",
    "name": "Business Current Account",
    "accountNumber": "****1234",
    "sortCode": "20-00-00",
    "currency": "GBP",
    "currentBalance": 25000.00,
    "isActive": true
  }
]
```

#### Create Bank Account
```http
POST /api/trpc/bankAccounts.create
```

**Request Body:**
```json
{
  "organizationId": "org_id",
  "name": "Business Current Account",
  "accountNumber": "12345678",
  "sortCode": "20-00-00",
  "currency": "GBP",
  "openingBalance": 10000.00
}
```

### Dashboard

#### Get Dashboard Stats
```http
GET /api/trpc/dashboard.getStats?organizationId=org_id
```

**Response:**
```json
{
  "totalRevenue": 50000.00,
  "totalExpenses": 30000.00,
  "netProfit": 20000.00,
  "cashPosition": 25000.00,
  "outstandingInvoices": 5,
  "overdueInvoices": 2,
  "bankBalances": [
    {
      "accountName": "Business Current Account",
      "balance": 25000.00,
      "currency": "GBP"
    }
  ]
}
```

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "details": {}
  }
}
```

### Error Codes

- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid input data
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API requests are rate limited to prevent abuse:

- **Authenticated users**: 1000 requests per hour
- **Unauthenticated users**: 100 requests per hour

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Webhooks

Sumtise supports webhooks for real-time notifications:

### Webhook Events

- `invoice.created`
- `invoice.paid`
- `invoice.overdue`
- `customer.created`
- `transaction.created`
- `payment.received`

### Webhook Payload

```json
{
  "event": "invoice.paid",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "invoiceId": "invoice_id",
    "amount": 1200.00,
    "currency": "GBP",
    "customerId": "customer_id"
  }
}
```

## SDKs and Libraries

### TypeScript/JavaScript

```typescript
import { createTRPCClient } from '@trpc/client'
import type { AppRouter } from './server/routers/app'

const client = createTRPCClient<AppRouter>({
  url: 'http://localhost:3000/api/trpc',
})

// Use the client
const invoices = await client.invoices.getAll.query({
  organizationId: 'org_id',
  page: 1,
  limit: 10
})
```

### Python

```python
import requests

headers = {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
}

response = requests.get(
    'http://localhost:3000/api/trpc/invoices.getAll',
    headers=headers,
    params={
        'organizationId': 'org_id',
        'page': 1,
        'limit': 10
    }
)

invoices = response.json()
```

## Testing

### Postman Collection

Import the provided Postman collection for easy API testing:

1. Download `Sumtise-API.postman_collection.json`
2. Import into Postman
3. Set environment variables:
   - `base_url`: Your API base URL
   - `auth_token`: Your JWT token

### cURL Examples

#### Get Dashboard Stats
```bash
curl -X GET \
  'http://localhost:3000/api/trpc/dashboard.getStats?organizationId=org_id' \
  -H 'Authorization: Bearer your-jwt-token'
```

#### Create Invoice
```bash
curl -X POST \
  'http://localhost:3000/api/trpc/invoices.create' \
  -H 'Authorization: Bearer your-jwt-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "organizationId": "org_id",
    "customerId": "customer_id",
    "date": "2024-01-01T00:00:00Z",
    "dueDate": "2024-01-31T00:00:00Z",
    "items": [
      {
        "description": "Product/Service",
        "quantity": 1,
        "unitPrice": 1000.00,
        "taxRate": 20.00
      }
    ]
  }'
```

## Support

For API support and questions:
- **Documentation**: [API Docs](https://docs.sumtise.com/api)
- **Support**: support@sumtise.com
- **GitHub Issues**: [API Issues](https://github.com/sumtise/issues)
