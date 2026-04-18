#!/bin/bash

# Sumtise Project Validation Script
# This script validates that all components are properly configured

echo "🔍 Validating Sumtise Project Configuration"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation functions
validate_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1 exists${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 missing${NC}"
        return 1
    fi
}

validate_directory() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅ $1 directory exists${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 directory missing${NC}"
        return 1
    fi
}

validate_package() {
    if grep -q "$1" package.json; then
        echo -e "${GREEN}✅ $1 package included${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 package missing${NC}"
        return 1
    fi
}

# Track validation results
validation_passed=true

echo ""
echo "📁 Checking Project Structure..."

# Core configuration files
validate_file "package.json" || validation_passed=false
validate_file "tsconfig.json" || validation_passed=false
validate_file "tailwind.config.ts" || validation_passed=false
validate_file "next.config.js" || validation_passed=false
validate_file "postcss.config.js" || validation_passed=false
validate_file ".eslintrc.json" || validation_passed=false
validate_file "env.example" || validation_passed=false
validate_file "README.md" || validation_passed=false
validate_file "Dockerfile" || validation_passed=false
validate_file "docker-compose.yml" || validation_passed=false
validate_file "setup.sh" || validation_passed=false

echo ""
echo "📂 Checking Directory Structure..."

# Core directories
validate_directory "src" || validation_passed=false
validate_directory "src/app" || validation_passed=false
validate_directory "src/components" || validation_passed=false
validate_directory "src/lib" || validation_passed=false
validate_directory "src/server" || validation_passed=false
validate_directory "src/types" || validation_passed=false
validate_directory "prisma" || validation_passed=false
validate_directory "public" || validation_passed=false

echo ""
echo "🔧 Checking Core Files..."

# Essential source files
validate_file "src/app/layout.tsx" || validation_passed=false
validate_file "src/app/page.tsx" || validation_passed=false
validate_file "src/app/globals.css" || validation_passed=false
validate_file "src/lib/prisma.ts" || validation_passed=false
validate_file "src/lib/trpc.ts" || validation_passed=false
validate_file "src/lib/auth.ts" || validation_passed=false
validate_file "src/lib/utils.ts" || validation_passed=false
validate_file "src/types/schemas.ts" || validation_passed=false
validate_file "prisma/schema.prisma" || validation_passed=false

echo ""
echo "🌐 Checking API Routes..."

# API routes
validate_file "src/app/api/trpc/[trpc]/route.ts" || validation_passed=false
validate_file "src/app/api/auth/[...nextauth]/route.ts" || validation_passed=false
validate_file "src/app/api/auth/register/route.ts" || validation_passed=false
validate_file "src/app/api/health/route.ts" || validation_passed=false

echo ""
echo "📱 Checking Application Pages..."

# Application pages
validate_file "src/app/auth/signin/page.tsx" || validation_passed=false
validate_file "src/app/auth/signup/page.tsx" || validation_passed=false
validate_file "src/app/invoices/page.tsx" || validation_passed=false
validate_file "src/app/expenses/page.tsx" || validation_passed=false
validate_file "src/app/banking/page.tsx" || validation_passed=false
validate_file "src/app/reports/page.tsx" || validation_passed=false
validate_file "src/app/tax/page.tsx" || validation_passed=false
validate_file "src/app/ai/page.tsx" || validation_passed=false

echo ""
echo "🧩 Checking Components..."

# UI Components
validate_file "src/components/providers.tsx" || validation_passed=false
validate_file "src/components/navigation.tsx" || validation_passed=false
validate_file "src/components/ui/button.tsx" || validation_passed=false
validate_file "src/components/ui/card.tsx" || validation_passed=false
validate_file "src/components/ui/input.tsx" || validation_passed=false
validate_file "src/components/ui/label.tsx" || validation_passed=false
validate_file "src/components/ui/badge.tsx" || validation_passed=false
validate_file "src/components/ui/progress.tsx" || validation_passed=false

echo ""
echo "🔌 Checking Server Components..."

# Server components
validate_file "src/server/routers/app.ts" || validation_passed=false
validate_file "src/lib/ai/ai-service.ts" || validation_passed=false
validate_file "src/lib/trpc-client.ts" || validation_passed=false

echo ""
echo "📦 Checking Package Dependencies..."

# Essential packages
validate_package "next" || validation_passed=false
validate_package "react" || validation_passed=false
validate_package "typescript" || validation_passed=false
validate_package "@prisma/client" || validation_passed=false
validate_package "@trpc/server" || validation_passed=false
validate_package "next-auth" || validation_passed=false
validate_package "tailwindcss" || validation_passed=false
validate_package "zod" || validation_passed=false
validate_package "openai" || validation_passed=false
validate_package "recharts" || validation_passed=false

echo ""
echo "🧪 Checking Test Files..."

# Test files
validate_file "src/__tests__/api.test.ts" || validation_passed=false

echo ""
echo "📚 Checking Documentation..."

# Documentation files
validate_file "DEPLOYMENT.md" || validation_passed=false
validate_file "API_DOCUMENTATION.md" || validation_passed=false
validate_file "PROJECT_SUMMARY.md" || validation_passed=false

echo ""
echo "🔍 Checking File Counts..."

# Count files
ts_files=$(find src -name "*.ts" -o -name "*.tsx" | wc -l)
js_files=$(find . -name "*.js" | wc -l)
json_files=$(find . -name "*.json" | wc -l)
md_files=$(find . -name "*.md" | wc -l)

echo -e "${GREEN}📊 Project Statistics:${NC}"
echo "   TypeScript/React files: $ts_files"
echo "   JavaScript files: $js_files"
echo "   JSON files: $json_files"
echo "   Markdown files: $md_files"

echo ""
echo "🔧 Checking Configuration..."

# Check if setup script is executable
if [ -x "setup.sh" ]; then
    echo -e "${GREEN}✅ setup.sh is executable${NC}"
else
    echo -e "${RED}❌ setup.sh is not executable${NC}"
    validation_passed=false
fi

# Check if Docker files exist
if [ -f "Dockerfile" ] && [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✅ Docker configuration complete${NC}"
else
    echo -e "${RED}❌ Docker configuration incomplete${NC}"
    validation_passed=false
fi

# Check if environment template exists
if [ -f "env.example" ]; then
    echo -e "${GREEN}✅ Environment template exists${NC}"
else
    echo -e "${RED}❌ Environment template missing${NC}"
    validation_passed=false
fi

echo ""
echo "🎯 Final Validation Results"
echo "=========================="

if [ "$validation_passed" = true ]; then
    echo -e "${GREEN}🎉 All validations passed!${NC}"
    echo -e "${GREEN}✅ Sumtise project is properly configured${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run: ./setup.sh"
    echo "2. Update .env.local with your configuration"
    echo "3. Run: npm run dev"
    echo "4. Visit: http://localhost:3000"
    echo ""
    echo -e "${GREEN}🚀 Ready for development and deployment!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some validations failed${NC}"
    echo -e "${RED}⚠️  Please fix the issues above before proceeding${NC}"
    echo ""
    echo "Common fixes:"
    echo "- Ensure all files are created"
    echo "- Check file permissions"
    echo "- Verify package.json dependencies"
    echo "- Run: chmod +x setup.sh"
    exit 1
fi
