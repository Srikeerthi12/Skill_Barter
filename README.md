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
- **Database**: MongoDB

## Project Structure

- `backend/` — Express API + Socket.IO server + DB schema/migrations scripts
- `frontend/` — React app (Vite)

## Prerequisites

- Node.js 18+ recommended
- MongoDB 6+ recommended (local or Atlas)

## Quick Start

### 1) Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```dotenv
PORT=5000

# MongoDB connection string.
# Examples:
# - mongodb://localhost:27017/skill-barter
# - mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
MONGODB_URI=mongodb://localhost:27017/skill-barter

JWT_SECRET=replace_with_a_long_random_string

# 32-byte key (hex or base64). Example below is hex (64 chars).
MESSAGE_ENCRYPTION_KEY=REPLACE_WITH_64_HEX_CHARS
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

When `MESSAGE_ENCRYPTION_KEY` is set, the backend encrypts sensitive text before writing to MongoDB (AES‑256‑GCM). The API decrypts on read so the UI continues to behave normally.

Encrypted columns include:

- `exchanges.message`
- `exchange_messages.body`
- `exchange_feedback.comment`
- `exchange_message_attachments.original_name`

### Generate an encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```


## Useful Commands

Backend (from `backend/`):

- `npm run dev` — dev server (nodemon)
- `npm run start` — production-style start

Frontend (from `frontend/`):

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run preview` — preview production build

## Troubleshooting

- **Frontend port in use**: run `npm run dev -- --port 5173` or change `frontend/vite.config.js`.
- **Backend can’t connect to MongoDB**: verify `MONGODB_URI` and that MongoDB is running/reachable.
- **Encrypted data looks blank**: if the key changes, decryption intentionally fails closed; restore the original `MESSAGE_ENCRYPTION_KEY`.