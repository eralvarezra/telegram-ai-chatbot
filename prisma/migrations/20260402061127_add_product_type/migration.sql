/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `AdminUser` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_secret" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "BotConfig" ADD COLUMN     "ai_description" TEXT,
ADD COLUMN     "ai_generated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "media_response_template" TEXT NOT NULL DEFAULT 'Aquí tienes {keyword} 💋 ¿te interesa?';

-- AlterTable
ALTER TABLE "MediaContent" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "owner_user_id" INTEGER,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "product_id" INTEGER,
ADD COLUMN     "tags" TEXT,
ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "type" TEXT NOT NULL DEFAULT 'product',
    "owner_user_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethodConfig" (
    "id" SERIAL NOT NULL,
    "method_type" TEXT NOT NULL,
    "account_identifier" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "bot_config_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPaymentMethod" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "stripe_payment_method_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "last4" TEXT,
    "exp_month" INTEGER,
    "exp_year" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "last_active" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "stripe_invoice_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "invoice_url" TEXT,
    "invoice_pdf" TEXT,
    "description" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConfigGeneration" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "description" TEXT NOT NULL,
    "generated_config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConfigGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotConfigVersion" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL,
    "config_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT 'user',

    CONSTRAINT "BotConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedUser" (
    "id" SERIAL NOT NULL,
    "owner_user_id" INTEGER NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "username" TEXT,
    "display_name" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaView" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "media_id" INTEGER NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "owner_user_id" INTEGER,

    CONSTRAINT "MediaView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_owner_user_id_idx" ON "Product"("owner_user_id");

-- CreateIndex
CREATE INDEX "Product_is_active_idx" ON "Product"("is_active");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "Product"("type");

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_method_type_idx" ON "PaymentMethodConfig"("method_type");

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_bot_config_id_idx" ON "PaymentMethodConfig"("bot_config_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_user_id_key" ON "Subscription"("user_id");

-- CreateIndex
CREATE INDEX "Subscription_user_id_idx" ON "Subscription"("user_id");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "UserPaymentMethod_user_id_idx" ON "UserPaymentMethod"("user_id");

-- CreateIndex
CREATE INDEX "UserPaymentMethod_is_default_idx" ON "UserPaymentMethod"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_hash_key" ON "UserSession"("token_hash");

-- CreateIndex
CREATE INDEX "UserSession_user_id_idx" ON "UserSession"("user_id");

-- CreateIndex
CREATE INDEX "UserSession_token_hash_idx" ON "UserSession"("token_hash");

-- CreateIndex
CREATE INDEX "UserSession_expires_at_idx" ON "UserSession"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripe_invoice_id_key" ON "Invoice"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "Invoice_user_id_idx" ON "Invoice"("user_id");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "AIConfigGeneration_user_id_idx" ON "AIConfigGeneration"("user_id");

-- CreateIndex
CREATE INDEX "AIConfigGeneration_status_idx" ON "AIConfigGeneration"("status");

-- CreateIndex
CREATE INDEX "AIConfigGeneration_created_at_idx" ON "AIConfigGeneration"("created_at");

-- CreateIndex
CREATE INDEX "BotConfigVersion_config_id_idx" ON "BotConfigVersion"("config_id");

-- CreateIndex
CREATE INDEX "BotConfigVersion_created_at_idx" ON "BotConfigVersion"("created_at");

-- CreateIndex
CREATE INDEX "BlockedUser_owner_user_id_idx" ON "BlockedUser"("owner_user_id");

-- CreateIndex
CREATE INDEX "BlockedUser_telegram_id_idx" ON "BlockedUser"("telegram_id");

-- CreateIndex
CREATE INDEX "BlockedUser_owner_user_id_telegram_id_idx" ON "BlockedUser"("owner_user_id", "telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedUser_owner_user_id_telegram_id_key" ON "BlockedUser"("owner_user_id", "telegram_id");

-- CreateIndex
CREATE INDEX "MediaView_user_id_idx" ON "MediaView"("user_id");

-- CreateIndex
CREATE INDEX "MediaView_media_id_idx" ON "MediaView"("media_id");

-- CreateIndex
CREATE INDEX "MediaView_viewed_at_idx" ON "MediaView"("viewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "MediaView_user_id_media_id_key" ON "MediaView"("user_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUser_stripe_customer_id_idx" ON "AdminUser"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "MediaContent_owner_user_id_idx" ON "MediaContent"("owner_user_id");

-- CreateIndex
CREATE INDEX "MediaContent_is_active_idx" ON "MediaContent"("is_active");

-- CreateIndex
CREATE INDEX "MediaContent_featured_idx" ON "MediaContent"("featured");

-- CreateIndex
CREATE INDEX "MediaContent_priority_idx" ON "MediaContent"("priority");

-- CreateIndex
CREATE INDEX "MediaContent_product_id_idx" ON "MediaContent"("product_id");

-- AddForeignKey
ALTER TABLE "MediaContent" ADD CONSTRAINT "MediaContent_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethodConfig" ADD CONSTRAINT "PaymentMethodConfig_bot_config_id_fkey" FOREIGN KEY ("bot_config_id") REFERENCES "BotConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPaymentMethod" ADD CONSTRAINT "UserPaymentMethod_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaView" ADD CONSTRAINT "MediaView_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaView" ADD CONSTRAINT "MediaView_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "MediaContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
