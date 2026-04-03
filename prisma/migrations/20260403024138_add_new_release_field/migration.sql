-- AlterTable
ALTER TABLE "MediaContent" ADD COLUMN     "is_new_release" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "MediaContent_is_new_release_idx" ON "MediaContent"("is_new_release");
