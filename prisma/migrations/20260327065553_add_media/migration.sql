-- CreateTable
CREATE TABLE "MediaContent" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "keywords" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MediaContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMedia" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "media_id" INTEGER NOT NULL,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "purchased_at" TIMESTAMP(3),

    CONSTRAINT "UserMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaContent_keywords_idx" ON "MediaContent"("keywords");

-- CreateIndex
CREATE UNIQUE INDEX "UserMedia_user_id_media_id_key" ON "UserMedia"("user_id", "media_id");

-- AddForeignKey
ALTER TABLE "UserMedia" ADD CONSTRAINT "UserMedia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMedia" ADD CONSTRAINT "UserMedia_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "MediaContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
