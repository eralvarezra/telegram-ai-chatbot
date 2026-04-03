-- CreateTable
CREATE TABLE "Agent" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Assistant',
    "personality_config" JSONB,
    "system_prompt" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'playful',
    "response_style" TEXT NOT NULL DEFAULT 'short',
    "engagement_level" INTEGER NOT NULL DEFAULT 3,
    "sales_strategy" TEXT,
    "restrictions" TEXT,
    "business_name" TEXT,
    "business_type" TEXT,
    "products_services" TEXT,
    "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
    "memory_summary" TEXT,
    "language" TEXT NOT NULL DEFAULT 'spanish',
    "greeting_style" TEXT,
    "farewell_style" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMemory" (
    "id" SERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "context_summary" TEXT,
    "key_facts" JSONB,
    "last_topic" TEXT,
    "sentiment" TEXT,
    "intent" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "purchase_intent" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "personality_config" JSONB NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'friendly',
    "response_style" TEXT NOT NULL DEFAULT 'short',
    "engagement_level" INTEGER NOT NULL DEFAULT 3,
    "default_restrictions" TEXT,
    "suggested_products" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_user_id_key" ON "Agent"("user_id");

-- CreateIndex
CREATE INDEX "Agent_user_id_idx" ON "Agent"("user_id");

-- CreateIndex
CREATE INDEX "ConversationMemory_agent_id_idx" ON "ConversationMemory"("agent_id");

-- CreateIndex
CREATE INDEX "ConversationMemory_contact_id_idx" ON "ConversationMemory"("contact_id");

-- CreateIndex
CREATE INDEX "ConversationMemory_last_message_at_idx" ON "ConversationMemory"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMemory_agent_id_contact_id_key" ON "ConversationMemory"("agent_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTemplate_name_key" ON "AgentTemplate"("name");

-- CreateIndex
CREATE INDEX "AgentTemplate_category_idx" ON "AgentTemplate"("category");

-- CreateIndex
CREATE INDEX "AgentTemplate_is_active_idx" ON "AgentTemplate"("is_active");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMemory" ADD CONSTRAINT "ConversationMemory_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMemory" ADD CONSTRAINT "ConversationMemory_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
