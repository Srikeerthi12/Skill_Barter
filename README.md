# Skill Barter — Skill Bartering Platform

A full‑stack web app for **skill-for-skill exchanges** (no money involved). Users can list skills, discover other users’ skills, request an exchange, chat after acceptance, and leave feedback once completed.

## Key Features

- **Auth**: Register/login with JWT
- **Skills**: Create, edit, browse, and view skill details
- **Requests & exchanges**: Request an exchange by selecting a skill; accept/reject/cancel; completion flow
- **Chat**: Real‑time messaging via Socket.IO (available after an exchange is accepted)
- **Feedback & ratings**: Post-exchange rating + comment; ratings aggregate into skill profiles
- **Uploads**: Simple attachment uploads (served from the backend)
- **Privacy (encryption-at-rest)**: Sensitive text is encrypted in Postgres while the UI continues to show plaintext

## Tech Stack

- **Frontend**: React + Vite, React Router, React Query, Axios
- **Backend**: Node.js + Express, Socket.IO
- **Database**: PostgreSQL

## Project Structure

- `backend/` — Express API + Socket.IO server + DB schema/migrations scripts
- `frontend/` — React app (Vite)

## Prerequisites

- Node.js 18+ recommended
- PostgreSQL 13+ recommended

## Quick Start

### 1) Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```dotenv
PORT=5000

# Use either DATABASE_URL or individual PG* fields.
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/SBS

JWT_SECRET=replace_with_a_long_random_string

# 32-byte key (hex or base64). Example below is hex (64 chars).
MESSAGE_ENCRYPTION_KEY=REPLACE_WITH_64_HEX_CHARS
```

Initialize/upgrade the schema:

```bash
npm run db:init
```

Start the backend:

```bash
npm run dev
```

Health check:

- http://localhost:5000/api/health

### 2) Frontend

```bash
cd ../frontend
npm install
```

Optional `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

Vite default port is configured in `frontend/vite.config.js` (strict). If the port is busy, run:

```bash
npm run dev -- --port 5173
```

## Encryption-at-Rest (Database Privacy)

When `MESSAGE_ENCRYPTION_KEY` is set, the backend encrypts sensitive text before writing to Postgres (AES‑256‑GCM). The API decrypts on read so the UI continues to behave normally.

Encrypted columns include:

- `exchanges.message`
- `exchange_messages.body`
- `exchange_feedback.comment`
- `exchange_message_attachments.original_name`

### Generate an encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Encrypt existing plaintext rows (one-time)

Run these **after** setting `MESSAGE_ENCRYPTION_KEY`:

```bash
cd backend
npm run db:encrypt-messages
npm run db:encrypt-sensitive
```

### Verify encryption in Postgres

Look for values starting with `enc:v1:`:

```sql
SELECT id, LEFT(message, 20) AS message_prefix
FROM exchanges
WHERE message IS NOT NULL
ORDER BY id DESC
LIMIT 20;

SELECT id, exchange_id, LEFT(body, 20) AS body_prefix
FROM exchange_messages
ORDER BY id DESC
LIMIT 50;

SELECT id, exchange_id, LEFT(comment, 20) AS comment_prefix
FROM exchange_feedback
WHERE comment IS NOT NULL
ORDER BY id DESC
LIMIT 50;

SELECT id, LEFT(original_name, 20) AS name_prefix
FROM exchange_message_attachments
ORDER BY id DESC
LIMIT 50;
```

## Useful Commands

Backend (from `backend/`):

- `npm run dev` — dev server (nodemon)
- `npm run start` — production-style start
- `npm run db:init` — apply/upgrade schema
- `npm run db:encrypt-messages` — encrypt legacy chat bodies
- `npm run db:encrypt-sensitive` — encrypt other sensitive columns

Frontend (from `frontend/`):

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run preview` — preview production build

## Troubleshooting

- **Frontend port in use**: run `npm run dev -- --port 5173` or change `frontend/vite.config.js`.
- **Backend can’t connect to Postgres**: verify `DATABASE_URL` and that Postgres is running.
- **Encrypted data looks blank**: if the key changes, decryption intentionally fails closed; restore the original `MESSAGE_ENCRYPTION_KEY`.