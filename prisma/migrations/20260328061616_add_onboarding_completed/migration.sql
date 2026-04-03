/*
  Warnings:

  - You are about to drop the column `is_premium` on the `MediaContent` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `MediaContent` table. All the data in the column will be lost.
  - You are about to drop the `UserMedia` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserMedia" DROP CONSTRAINT "UserMedia_media_id_fkey";

-- DropForeignKey
ALTER TABLE "UserMedia" DROP CONSTRAINT "UserMedia_user_id_fkey";

-- AlterTable
ALTER TABLE "BotConfig" ADD COLUMN     "admin_password" TEXT NOT NULL DEFAULT 'admin123',
ADD COLUMN     "engagement_level" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "message_style" TEXT NOT NULL DEFAULT '["short","casual"]',
ADD COLUMN     "payment_confirm_message" TEXT,
ADD COLUMN     "restrictions" TEXT,
ADD COLUMN     "sales_strategy" TEXT,
ADD COLUMN     "tone" TEXT NOT NULL DEFAULT 'playful',
ADD COLUMN     "user_gender_mode" TEXT NOT NULL DEFAULT 'auto',
ALTER COLUMN "products" SET DEFAULT 'Sexting personalizado,Videollamadas privadas,Packs de fotos/videos, Videos personalizados';

-- AlterTable
ALTER TABLE "MediaContent" DROP COLUMN "is_premium",
DROP COLUMN "price";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "bot_instance_id" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bot_instance_id" TEXT,
ADD COLUMN     "last_tone" TEXT;

-- DropTable
DROP TABLE "UserMedia";

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "pack_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "payment_method" TEXT NOT NULL DEFAULT 'sinpe',
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "picture" TEXT,
    "google_id" TEXT,
    "password_hash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_user_id_idx" ON "Payment"("user_id");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "PaymentProof_payment_id_idx" ON "PaymentProof"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_google_id_key" ON "AdminUser"("google_id");

-- CreateIndex
CREATE INDEX "AdminUser_email_idx" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "Message_bot_instance_id_idx" ON "Message"("bot_instance_id");

-- CreateIndex
CREATE INDEX "User_telegram_id_idx" ON "User"("telegram_id");

-- CreateIndex
CREATE INDEX "User_bot_instance_id_idx" ON "User"("bot_instance_id");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
