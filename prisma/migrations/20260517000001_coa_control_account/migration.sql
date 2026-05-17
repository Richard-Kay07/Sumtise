ALTER TABLE "chart_of_accounts"
  ADD COLUMN "analysisCode3"    TEXT,
  ADD COLUMN "isControlAccount" BOOLEAN NOT NULL DEFAULT false;
