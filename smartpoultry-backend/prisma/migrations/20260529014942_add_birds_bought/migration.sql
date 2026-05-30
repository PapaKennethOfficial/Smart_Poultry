/*
  Warnings:

  - You are about to drop the column `eggCount` on the `LogEntry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "endpoint" TEXT;

-- AlterTable
ALTER TABLE "LogEntry" DROP COLUMN "eggCount",
ADD COLUMN     "birdsBought" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyEggPurchases" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "eggsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weeklyEggPurchases" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "format" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "LogEntry_batchId_date_idx" ON "LogEntry"("batchId", "date");

-- CreateIndex
CREATE INDEX "LogEntry_userId_idx" ON "LogEntry"("userId");

-- CreateIndex
CREATE INDEX "Report_userId_idx" ON "Report"("userId");

-- CreateIndex
CREATE INDEX "Report_farmId_idx" ON "Report"("farmId");
