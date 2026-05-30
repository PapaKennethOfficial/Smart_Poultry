-- Add role values introduced after the initial migration.
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE 'DELIVERY';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE 'CUSTOMER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Repair earlier egg-count naming drift when migrating older local databases.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'LogEntry' AND column_name = 'eggCount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'LogEntry' AND column_name = 'eggsCount'
  ) THEN
    ALTER TABLE "LogEntry" RENAME COLUMN "eggCount" TO "eggsCount";
  END IF;
END $$;

ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "format" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "endpoint" TEXT;

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'kg',
  "stock" INTEGER NOT NULL DEFAULT 0,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "driverId" TEXT;
ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "contactNumber" TEXT;
ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'PAY_ON_DELIVERY';
ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "deliveryLatitude" DOUBLE PRECISION;
ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "deliveryLongitude" DOUBLE PRECISION;
ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "driverLatitude" DOUBLE PRECISION;
ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "driverLongitude" DOUBLE PRECISION;
ALTER TABLE "DeliveryOrder" ADD COLUMN IF NOT EXISTS "driverLocationUpdatedAt" TIMESTAMP(3);

ALTER TABLE "DeliveryOrder" DROP COLUMN IF EXISTS "customer";
ALTER TABLE "DeliveryOrder" DROP COLUMN IF EXISTS "product";
ALTER TABLE "DeliveryOrder" DROP COLUMN IF EXISTS "driver";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "DeliveryOrder" WHERE "customerId" IS NULL) THEN
    ALTER TABLE "DeliveryOrder" ALTER COLUMN "customerId" SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "DeliveryOrder" WHERE "productId" IS NULL) THEN
    ALTER TABLE "DeliveryOrder" ALTER COLUMN "productId" SET NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryOrder_customerId_fkey'
  ) THEN
    ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryOrder_productId_fkey'
  ) THEN
    ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryOrder_driverId_fkey'
  ) THEN
    ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DeliveryOrder_customerId_idx" ON "DeliveryOrder"("customerId");
CREATE INDEX IF NOT EXISTS "DeliveryOrder_driverId_idx" ON "DeliveryOrder"("driverId");
CREATE INDEX IF NOT EXISTS "DeliveryOrder_status_idx" ON "DeliveryOrder"("status");

CREATE TABLE IF NOT EXISTS "Vehicle" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year_of_manufacture" INTEGER NOT NULL,
  "license_plate" TEXT,
  "vin" TEXT,
  "color" TEXT NOT NULL,
  "vehicle_type" TEXT NOT NULL,
  "insurance_provider" TEXT,
  "insurance_policy_number" TEXT,
  "insurance_expiration" TIMESTAMP(3),
  "driver_contact_number" TEXT NOT NULL DEFAULT '',
  "driver_residential_address" TEXT NOT NULL DEFAULT '',
  "driver_license_number" TEXT NOT NULL,
  "license_expiration" TIMESTAMP(3) NOT NULL,
  "vehicle_photo" TEXT,
  "insurance_document" TEXT,
  "registration_document" TEXT,
  "driver_photo" TEXT,
  "seating_capacity" INTEGER,
  "mileage" DOUBLE PRECISION,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
  "verification_notes" TEXT,
  "verified_by" TEXT,
  "verified_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "changes_requested" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_user_id_key" ON "Vehicle"("user_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Vehicle_user_id_fkey'
  ) THEN
    ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Vehicle_verified_by_fkey'
  ) THEN
    ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_verified_by_fkey"
    FOREIGN KEY ("verified_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "driver_photo" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "driver_contact_number" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "driver_residential_address" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "UserNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'INFO',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserNotification_userId_fkey'
  ) THEN
    ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "UserNotification_userId_isRead_idx" ON "UserNotification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "UserNotification_createdAt_idx" ON "UserNotification"("createdAt");

CREATE TABLE IF NOT EXISTS "DeliveryMessage" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryMessage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryMessage_orderId_fkey'
  ) THEN
    ALTER TABLE "DeliveryMessage" ADD CONSTRAINT "DeliveryMessage_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "DeliveryOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryMessage_senderId_fkey'
  ) THEN
    ALTER TABLE "DeliveryMessage" ADD CONSTRAINT "DeliveryMessage_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DeliveryMessage_orderId_createdAt_idx" ON "DeliveryMessage"("orderId", "createdAt");
