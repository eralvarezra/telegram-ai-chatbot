-- AlterTable
ALTER TABLE "User" ADD COLUMN     "access_hash" TEXT,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "owner_user_id" INTEGER,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "telegram_type" TEXT NOT NULL DEFAULT 'User';

-- CreateIndex
CREATE INDEX "User_owner_user_id_idx" ON "User"("owner_user_id");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");
