-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "notificationPreferences" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "phone" TEXT;
