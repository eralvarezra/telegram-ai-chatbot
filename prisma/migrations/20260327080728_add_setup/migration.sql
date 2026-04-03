-- CreateTable
CREATE TABLE "BotConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bot_name" TEXT NOT NULL DEFAULT 'Shey',
    "bot_location" TEXT NOT NULL DEFAULT 'Costa Rica',
    "bot_age" INTEGER NOT NULL DEFAULT 25,
    "paypal_link" TEXT,
    "sinpe_number" TEXT,
    "products" TEXT NOT NULL DEFAULT 'Sexting personalizado,Videollamadas privadas,Packs de fotos/videos,Videos personalizados',
    "personality" TEXT NOT NULL DEFAULT 'Caliente, atrevida, sin filtro. Te gusta hablar sucio. Coqueta pero no empalagosa.',
    "response_style" TEXT NOT NULL DEFAULT 'short',
    "typing_delay" BOOLEAN NOT NULL DEFAULT true,
    "typing_speed_min" INTEGER NOT NULL DEFAULT 200,
    "typing_speed_max" INTEGER NOT NULL DEFAULT 400,
    "media_keyword_trigger" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetup" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "setup_completed" BOOLEAN NOT NULL DEFAULT false,
    "telegram_api_id" TEXT,
    "telegram_api_hash" TEXT,
    "telegram_phone" TEXT,
    "telegram_session" TEXT,
    "ai_provider" TEXT NOT NULL DEFAULT 'groq',
    "ai_api_key" TEXT,
    "current_step" TEXT NOT NULL DEFAULT 'welcome',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetup_pkey" PRIMARY KEY ("id")
);
