# Telegram Chatbot Dashboard

Modern SaaS dashboard for managing a Telegram AI chatbot.

## Tech Stack

- Next.js 14 (App Router)
- TailwindCSS
- Recharts
- Lucide Icons

## Getting Started

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## Pages

- `/` - Dashboard with stats and charts
- `/users` - User management table
- `/users/[id]` - User detail with chat history
- `/conversations` - Active conversations list
- `/settings` - Bot configuration

## Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## API Endpoints Expected

- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/:id/messages` - Get user messages
- `GET /api/stats` - Get dashboard stats
- `GET /api/conversations` - List conversations
- `POST /api/config` - Update bot config