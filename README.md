# Telegram AI Chatbot Platform

Multi-tenant Telegram AI chatbot platform with dual API key system supporting Free and Premium users.

## Features

- **Telegram Bot Integration**: Real-time messaging using MTProto (User Bot)
- **AI-Powered Responses**: OpenAI and Groq API integration
- **Dual API Key System**:
  - **Free users**: Use their own API keys with daily message limits (50/day)
  - **Premium users**: Platform-managed API keys with unlimited access
- **Rate Limiting**: Daily message limits with automatic reset
- **Usage Tracking**: Token usage monitoring for cost control
- **Multi-Tenant**: Each user can have their own bot instance
- **Payment Integration**: PayPal, SINPE, and custom payment methods
- **Media Management**: Send and manage media content

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL + Prisma ORM
- **AI**: OpenAI / Groq API
- **Telegram**: MTProto Client (telegram.js)

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Telegram API credentials (from https://my.telegram.org/apps)
- Groq or OpenAI API key

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd telegram-ai-chatbot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/telegram_bot?schema=public"

# Telegram Client (from https://my.telegram.org/apps)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE=+1234567890
TELEGRAM_SESSION=your_session_string

# AI - Groq (free) or OpenAI
AI_API_KEY=your_groq_api_key

# Frontend URL
FRONTEND_URL=http://localhost:3001

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Dual API Key System
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_KEY_ENCRYPTION_KEY=your_64_char_hex_key
DAILY_MESSAGE_LIMIT_FREE=50
MONTHLY_TOKEN_LIMIT_PREMIUM=1000000
PLATFORM_GROQ_KEY=your_platform_groq_key  # For premium users
```

### 4. Set up the database

```bash
# Create PostgreSQL database
createdb telegram_bot

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### 5. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 6. First run

On first run, Telegram will ask for:
- Verification code (sent to your Telegram)
- 2FA password (if configured)

After authentication, save the **session string** in `.env` as `TELEGRAM_SESSION`.

## API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login |
| `/api/auth/google` | GET | Google OAuth |

### API Key Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/api-key` | POST | Save user API key |
| `/api/api-key` | DELETE | Remove user API key |
| `/api/api-key/status` | GET | Get API key status |
| `/api/api-key/validate` | POST | Validate API key before saving |
| `/api/usage` | GET | Get usage statistics |
| `/api/usage/limits` | GET | Get current limits |
| `/api/api-key/plan` | PUT | Update user plan |

### Bot Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bot/start` | POST | Start bot instance |
| `/api/bot/stop` | POST | Stop bot instance |
| `/api/bot/status` | GET | Get bot status |

### Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/config` | GET | Get bot configuration |
| `/api/config` | PUT | Update configuration |

## Dual API Key System

### Free Users

1. Must provide their own API key (OpenAI or Groq)
2. Daily message limit (default: 50 messages/day)
3. Counter resets at midnight UTC
4. Rate limited with friendly messages

### Premium Users

1. Use platform-managed API keys
2. No daily message limits
3. Token usage tracking for cost control
4. Monthly token soft limits

### Architecture

```
Message Received
       │
       ▼
┌─────────────────┐
│  Get User Plan  │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌─────────┐
│ FREE  │ │ PREMIUM │
└───┬───┘ └────┬────┘
    │          │
    ▼          ▼
┌───────────┐ ┌────────────────┐
│ Check     │ │ Use Platform   │
│ Daily     │ │ API Key        │
│ Limit     │ │ (env var)      │
└─────┬─────┘ └───────┬────────┘
      │               │
      ▼               │
┌───────────┐         │
│ Use User  │         │
│ API Key   │         │
│(encrypted)│         │
└─────┬─────┘         │
      │               │
      └───────┬───────┘
              ▼
┌──────────────────┐
│ Process AI Call  │
│ Track Usage      │
└──────────────────┘
```

## Project Structure

```
src/
├── config/
│   ├── index.js        # Environment config
│   └── database.js     # Prisma client
├── middleware/
│   ├── auth.middleware.js
│   └── error.middleware.js
├── routes/
│   ├── apiKey.routes.js    # API key management
│   ├── auth.routes.js
│   ├── bot.routes.js
│   ├── config.routes.js
│   └── ...
├── services/
│   ├── apiKey.service.js       # Key selection logic
│   ├── rateLimit.service.js    # Daily limits
│   ├── usageTracking.service.js
│   ├── scheduler.service.js    # Cron jobs
│   ├── ai.service.js
│   └── ...
├── utils/
│   ├── encryption.js       # AES-256-GCM
│   ├── errors.js
│   └── logger.js
├── app.js
└── server.js
prisma/
├── schema.prisma
└── migrations/
dashboard/              # Next.js frontend
```

## Development

### Database changes

```bash
# Create migration
npx prisma migrate dev --name your_migration_name

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

### Testing API keys

```bash
# Validate Groq key
curl -X POST http://localhost:3000/api/api-key/validate \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "gsk_...", "provider": "groq"}'
```

## Security

- **Encryption**: API keys encrypted at rest using AES-256-GCM
- **Authentication**: JWT with 7-day expiration
- **Rate Limiting**: Prevents abuse from free users
- **Environment Variables**: All secrets in `.env`
- **No Logging**: API keys never logged

## Scheduled Tasks

- **Daily Reset**: Resets message counters at midnight UTC
- **Monthly Reset**: Resets token usage on the 1st of each month

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request