# Microsoft Careers Application Status Monitor

Automated tool that monitors your Microsoft Careers application status and sends Telegram notifications whenever the status changes.

## Features

- Monitors all applications on Microsoft Careers portal
- Detects status changes (e.g., Interview → Offer)
- Sends Telegram notifications with change details
- Screenshot on status change
- Daily heartbeat message
- Session expiry detection with alert
- Configurable check interval (15/30/60 min)
- Docker support
- GitHub Actions workflow

## Prerequisites

- Node.js 22+
- npm
- A Telegram bot (create via [@BotFather](https://t.me/BotFather))
- Your Telegram chat ID

## Telegram Setup

1. Message [@BotFather](https://t.me/BotFather) and run `/newbot`
2. Save the bot token
3. Message your bot, then visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` to find your chat ID

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/microsoft-status-monitor.git
cd microsoft-status-monitor

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy environment file
cp .env.example .env
```

Edit `.env` with your values:

```
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
CHECK_INTERVAL=30
HEADLESS=true
```

## First-Time Login

Before running the monitor, you need to authenticate with Microsoft:

```bash
npm run login
```

This will:
1. Open a Chromium browser window
2. Navigate to the Microsoft Careers portal
3. Wait for you to log in manually
4. Save the authenticated session to `auth.json`
5. Close the browser

Press Enter in the terminal once you've logged in.

## Running

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

Note: For Docker, you need to run `npm run login` locally first to generate `auth.json`, then mount it into the container.

## Project Structure

```
microsoft-status-monitor/
├── src/
│   ├── index.ts          # Entry point
│   ├── config.ts         # Environment configuration
│   ├── types.ts          # TypeScript interfaces
│   ├── logger.ts         # Logging utility
│   ├── auth.ts           # Playwright authentication
│   ├── monitor.ts        # Status detection logic
│   ├── telegram.ts       # Telegram notifications
│   ├── storage.ts        # JSON file persistence
│   └── scheduler.ts      # Cron scheduling
├── .github/workflows/
│   └── monitor.yml       # GitHub Actions workflow
├── auth.json             # Saved browser session (gitignored)
├── state.json            # Saved application state
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env.example
```

## How It Works

1. **Authentication**: Uses Playwright persistent context to maintain login state across runs
2. **API Fetch**: Calls `GET /api/pcsx/dashboard/applications` through the authenticated browser
3. **Change Detection**: Compares current status with previously stored state
4. **Notification**: Sends formatted message via Telegram Bot API
5. **State Persistence**: Saves current state to `state.json` for next comparison

## Example Output

### No Changes

```
[2026-07-12 20:30:00] Checking Microsoft Careers...
[2026-07-12 20:30:01] Found 1 application(s)
[2026-07-12 20:30:01]   • Software Engineer: Interview
[2026-07-12 20:30:01] No changes detected.
```

### Status Changed

```
[2026-07-12 20:30:00] Checking Microsoft Careers...
[2026-07-12 20:30:01] Found 1 application(s)
[2026-07-12 20:30:01]   • Software Engineer: Offer
[2026-07-12 20:30:01] Status changed! 1 change(s) detected.
[2026-07-12 20:30:01] Changed: Software Engineer
[2026-07-12 20:30:01]   Interview → Offer
[2026-07-12 20:30:02] Telegram notification sent successfully
```

### Telegram Message

```
🚀 Microsoft Careers Update

Job: Software Engineer
Application ID: abc-123

Old Status: Interview
New Status: Offer

Time: 12/07/2026, 08:30:00 PM IST
```

## GitHub Actions Setup

1. Add repository secrets:
   - `TELEGRAM_TOKEN` - Your bot token
   - `TELEGRAM_CHAT_ID` - Your chat ID
   - `AUTH_STATE_HASH` - Any value (used as cache key)

2. The workflow runs every 30 minutes via cron, or manually via `workflow_dispatch`

3. State is cached between runs using GitHub Actions cache

## Session Expiry

If the Microsoft session expires:
- The monitor detects the redirect to the login page
- Sends a Telegram alert: "Microsoft login session has expired"
- Re-run `npm run login` to re-authenticate

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `No auth.json found` | Run `npm run login` first |
| `Session expired` | Run `npm run login` again |
| `Telegram notification failed` | Check `TELEGRAM_TOKEN` and `TELEGRAM_CHAT_ID` |
| `API returned status 401` | Session expired, re-login |
| Browser won't start in Docker | Ensure `--no-sandbox` flag is present |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_TOKEN` | Yes | - | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Yes | - | Your Telegram chat ID |
| `CHECK_INTERVAL` | No | `30` | Check interval in minutes |
| `HEADLESS` | No | `true` | Run browser in headless mode |

## License

MIT
