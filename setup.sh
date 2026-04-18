#!/bin/bash

# Sumtise Setup Script
# This script sets up the Sumtise accounting software application

echo "🚀 Setting up Sumtise - Modern Accounting Software for SMEs"
echo "=============================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL is not installed. Please install PostgreSQL 14+ and try again."
    echo "   Visit: https://www.postgresql.org/download/"
    echo "   Continuing with setup..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create environment file
if [ ! -f .env.local ]; then
    echo "📝 Creating environment file..."
    cp env.example .env.local
    echo "✅ Environment file created (.env.local)"
    echo "⚠️  Please update .env.local with your actual configuration values"
else
    echo "✅ Environment file already exists"
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma client"
    exit 1
fi

echo "✅ Prisma client generated successfully"

# Check if database is configured
if [ -f .env.local ]; then
    DATABASE_URL=$(grep "DATABASE_URL" .env.local | cut -d'=' -f2)
    if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "postgresql://username:password@localhost:5432/sumtise" ]; then
        echo "⚠️  Database URL not configured in .env.local"
        echo "   Please update DATABASE_URL with your PostgreSQL connection string"
        echo "   Example: postgresql://username:password@localhost:5432/sumtise"
    else
        echo "✅ Database URL configured"
        
        # Try to connect to database and run migrations
        echo "🗄️  Running database migrations..."
        npm run db:migrate
        
        if [ $? -eq 0 ]; then
            echo "✅ Database migrations completed successfully"
        else
            echo "⚠️  Database migrations failed. Please check your database connection."
        fi
    fi
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p public/uploads
mkdir -p public/exports
mkdir -p logs

echo "✅ Directories created"

# Build the application
echo "🏗️  Building the application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Application built successfully"

echo ""
echo "🎉 Setup completed successfully!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your configuration:"
echo "   - Database connection string"
echo "   - NextAuth secret"
echo "   - OpenAI API key (optional)"
echo "   - Payment gateway keys (optional)"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Open your browser and visit:"
echo "   http://localhost:3000"
echo ""
echo "4. Create your first account and organization"
echo ""
echo "📚 Documentation: README.md"
echo "🆘 Support: https://github.com/your-username/sumtise/issues"
echo ""
echo "Happy accounting! 💰"
