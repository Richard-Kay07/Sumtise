-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DR', 'CR');

-- CreateEnum
CREATE TYPE "VatTreatment" AS ENUM ('STANDARD_RATE', 'REDUCED_RATE', 'ZERO_RATE', 'EXEMPT', 'OUT_OF_SCOPE', 'NOT_APPLICABLE');

-- AlterTable chart_of_accounts
ALTER TABLE "chart_of_accounts"
  ADD COLUMN "subType"       TEXT,
  ADD COLUMN "description"   TEXT,
  ADD COLUMN "normalBalance" "NormalBalance" NOT NULL DEFAULT 'DR',
  ADD COLUMN "vatTreatment"  "VatTreatment"  NOT NULL DEFAULT 'NOT_APPLICABLE';

-- Back-fill normalBalance: liability and equity accounts are naturally CR
UPDATE "chart_of_accounts"
SET "normalBalance" = 'CR'
WHERE "type" IN ('LIABILITY', 'EQUITY', 'REVENUE');
