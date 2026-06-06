DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStaffStatus') THEN
    CREATE TYPE "DeliveryStaffStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deliveryStaffStatus" "DeliveryStaffStatus";

UPDATE "User"
SET "deliveryStaffStatus" = 'PENDING'
WHERE "role" = 'DELIVERY' AND "deliveryStaffStatus" IS NULL;

UPDATE "User" AS u
SET "deliveryStaffStatus" = 'ACTIVE'
FROM "Vehicle" AS v
WHERE v."user_id" = u."id"
  AND u."role" = 'DELIVERY'
  AND v."verification_status" = 'APPROVED'
  AND v."is_active" = true;

UPDATE "User" AS u
SET "deliveryStaffStatus" = 'REJECTED'
FROM "Vehicle" AS v
WHERE v."user_id" = u."id"
  AND u."role" = 'DELIVERY'
  AND v."verification_status" = 'REJECTED'
  AND u."deliveryStaffStatus" <> 'ACTIVE';

ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "insurance_provider";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "insurance_policy_number";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "insurance_expiration";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "insurance_document";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "seating_capacity";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "mileage";

CREATE INDEX IF NOT EXISTS "DeliveryOrder_productId_idx" ON "DeliveryOrder"("productId");
CREATE INDEX IF NOT EXISTS "DeliveryOrder_deliveryDate_idx" ON "DeliveryOrder"("deliveryDate");
CREATE INDEX IF NOT EXISTS "DeliveryOrder_paymentStatus_idx" ON "DeliveryOrder"("paymentStatus");
CREATE INDEX IF NOT EXISTS "DeliveryOrder_paymentMethod_idx" ON "DeliveryOrder"("paymentMethod");
