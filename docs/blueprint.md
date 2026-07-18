# WhisperNG Anonymous Messaging Bot — Bot specification

**Archetype:** community

**Voice:** professional and warm — write every user-facing message, button label, error, and empty state in this voice.

Telegram bot enabling anonymous message submission, moderation, and stats with privacy-first design. Users control anonymity links, replies, and spam protection while moderators handle abuse reports and analytics.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Casual Telegram users seeking anonymous feedback
- Community moderators needing abuse controls
- Group admins wanting lightweight anonymous channels

## Success criteria

- Users receive and reply to anonymous messages securely
- Moderators handle 90%+ reports within 24 hours
- Spam submission rate <5% of total messages

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Register user and show personalized dashboard with anonymous link
  - inputs: Telegram user ID
  - outputs: Anonymous link, Quick action buttons
- **My Link** (button, actor: user, callback: link:preview) — Display and manage personal anonymous link
  - inputs: User settings
  - outputs: Link preview, Copy/share options
- **Inbox** (button, actor: user, callback: inbox:list) — View active anonymous messages with moderation options
  - inputs: Message status filters
  - outputs: Message list with timestamps, Action buttons
- **/report** (command, actor: user, command: /report) — Submit abuse report for current message
  - inputs: Message ID, Report reason
  - outputs: Admin notification, Moderation action

## Flows

### Anonymous message submission
_Trigger:_ Deep link activation

1. Visitor accesses t.me/whisperng?start=token
2. Rate limit check and optional CAPTCHA
3. Message submission form with text/emoji
4. Recipient notification with reply/report options

_Data touched:_ AnonymousMessage, RateLimitRecord

### Moderation workflow
_Trigger:_ /report

1. User submits report
2. Admin receives alert in private chat
3. Admin reviews message content
4. Admin takes action (delete/block)

_Data touched:_ Report, BlockList

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Telegram user profile with privacy settings
  - fields: telegram_id, anonymous_token, spam_sensitivity, message_retention
- **AnonymousMessage** _(retention: persistent)_ — Submitted anonymous content with metadata
  - fields: content, timestamp, ip_hash, status, ttl
- **Report** _(retention: persistent)_ — Abuse report record with investigation status
  - fields: message_id, reporter_id, reason, resolved

## Integrations

- **Telegram** (required) — Bot API messaging and moderation
- **PostgreSQL** (required) — Persistent data storage
- **Redis** (required) — Rate limiting and caching
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Admin dashboard access
- Global rate limit configuration
- Message deletion permissions
- Spam sensitivity tiers

## Notifications

- Admin alerts for severe abuse reports
- User notifications for new messages
- Spam threshold warnings

## Permissions & privacy

- All messages anonymized by default
- No PII stored or exposed
- Rate limiting without IP tracking
- User-controlled data retention

## Edge cases

- Invalid deep link tokens
- Concurrent message deletion during reply
- CAPTCHA bypass attempts
- Mass report abuse

## Required tests

- End-to-end anonymous message flow with reply chain
- Moderation workflow from report to deletion
- Rate limit enforcement across multiple clients

## Assumptions

- Telegram deep-link format is standard t.me/username?start=token
- CAPTCHA is optional for trusted users
- Admin notifications use separate bot account
