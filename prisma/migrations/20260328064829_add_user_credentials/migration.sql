-- CreateTable
CREATE TABLE "UserCredentials" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "telegram_api_id" TEXT,
    "telegram_api_hash" TEXT,
    "telegram_phone" TEXT,
    "telegram_session" TEXT,
    "ai_api_key" TEXT,
    "ai_provider" TEXT NOT NULL DEFAULT 'groq',
    "bot_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCredentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCredentials_user_id_key" ON "UserCredentials"("user_id");

-- CreateIndex
CREATE INDEX "UserCredentials_user_id_idx" ON "UserCredentials"("user_id");

-- AddForeignKey
ALTER TABLE "UserCredentials" ADD CONSTRAINT "UserCredentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
