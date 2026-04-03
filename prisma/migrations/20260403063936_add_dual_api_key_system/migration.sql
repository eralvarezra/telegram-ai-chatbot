-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "daily_message_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_reset_date" TIMESTAMP(3),
ADD COLUMN     "monthly_tokens_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "token_reset_date" TIMESTAMP(3),
ADD COLUMN     "total_tokens_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "user_api_key" TEXT,
ADD COLUMN     "user_api_key_iv" TEXT,
ADD COLUMN     "user_api_provider" TEXT DEFAULT 'groq';

-- CreateTable
CREATE TABLE "UsageTracking" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "api_key_type" TEXT NOT NULL,
    "cost_usd" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "UsageTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageTracking_user_id_idx" ON "UsageTracking"("user_id");

-- CreateIndex
CREATE INDEX "UsageTracking_timestamp_idx" ON "UsageTracking"("timestamp");

-- CreateIndex
CREATE INDEX "UsageTracking_user_id_timestamp_idx" ON "UsageTracking"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "AdminUser_plan_idx" ON "AdminUser"("plan");

-- AddForeignKey
ALTER TABLE "UsageTracking" ADD CONSTRAINT "UsageTracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
