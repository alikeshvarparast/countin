# CountIn — how the app works

CountIn is for recurring football groups. One person organizes. Everyone else RSVPs, shares the pitch cost, and gets told when something changes.

Live site: [https://countin.sspi.trade](https://countin.sspi.trade)

Money in CountIn is a **tracker only**. The app never takes a payment. Cash, e-transfer, and chasing unpaid amounts stay between players.

---

## What you can do

| You want to… | Use |
|--------------|-----|
| Find or start a club | Home search, **New club**, or an invite link |
| Play one night | A **weekly event** (pickup) |
| Play the same nights for weeks | A **season** with a contract vote |
| Skip a contract night | **Exchange request** (ask everyone, ask one person, or open the waitlist) |
| Cover someone | **Take this night only** or **Take over the contract** |
| Split costs | **Ledger** |
| Talk in the group | **Chat** |
| Get DMs | Link the **Telegram** bot on Profile |
| Ask for help | **Help** on Profile |

---

## Accounts

**Register** needs name, email, password (at least 8 characters), and a Telegram username or numeric ID. Telegram is required so the bot can DM you later. After you register, open the bot and tap **Start**.

**Log in** with email and password.

**Forgot password** needs the email **and** the Telegram username on the account. You get a reset link in the in-app inbox. The link lasts one hour.

**Profile** (`/app/profile`)

- Change name, photo, and Telegram username or ID
- Changing Telegram unlinks the bot until you Start again
- WhatsApp is stored for later; delivery is not live yet

---

## Clubs

A club is a private group with a public page, a UID (short code), and an invite link.

**Create a club:** name, description, pitch, timezone, currency, public or private, optional photo. You become the **owner**.

**Join**

| Club type | How you get in |
|-----------|----------------|
| Public | Search by name or UID → **Request to join** → an admin approves |
| Private | You can find it by UID, but you only join with an **invite link** |

**First time in a club** you must accept: credit is only a tracker; CountIn does not guarantee anyone pays.

### Roles

| Role | What they can do |
|------|------------------|
| **Owner** | Everything an admin can, plus edit club settings, regenerate the invite link, delete the club, make/remove admins, suspend, restore, and **remove members** |
| **Admin** | Create events and seasons, book the field, cancel, post costs, approve joins / guests / waitlist, add a member by email, change the club photo, see the full ledger |
| **Member** | RSVP, vote, chat, apply as occasional, claim exchanges, add guests when going |
| **Suspended** | Can still open the club and chat. Cannot vote, RSVP, or see poll voter lists until restored |

The owner cannot be suspended or removed. Only the owner can change someone’s role or remove them from the club.

Cancelled events, seasons, and nights are **hidden**. Opening an old cancelled link sends you back to the club home.

---

## Pickup events (one night)

Admins create these from **New event**.

Typical flow:

1. Set a time, **or** start with a **time poll**
2. Members vote on the poll (if there is one)
3. Admin **locks the time** → RSVP opens
4. Members mark **Going** or **Not going** until the presence deadline
5. When enough people are going, the event is **ready to book**
6. Admin confirms the **field is booked**
7. After play, admin **posts the cost** → the ledger splits it

**Guests:** you must be going first. Name them (for example “Ali's friend”). They wait until an admin approves. Approved guests count as going and as a share of the cost (on the host).

**Going count** = going members + approved guests.

Statuses you will see: polling → open → ready to book → booked → completed (after cost) or cancelled.

---

## Seasons (contract nights)

A season is a block of the same weeknights (for example Tue + Thu for six weeks). Nights **do not show** on the club home until two things happen:

1. An admin **closes the agreement**
2. An admin **creates the season nights**

### 1. Agreement

Everyone says **I agree to the contract** or **Not this season**.

- **In** → they will be contract players
- **Out** → they stay occasional for this season

The vote can stay open past the deadline until an admin closes it.

### 2. Rates

Admin sets:

- **Contract rate** — what a contract night costs (needed before replacements)
- **Occasional rate** — what a waitlist player pays (needed before waitlist approval)

### 3. Nights go live

Each date becomes its own event. Contract players are marked **present** on every future night automatically.

### Who is who

| | Contract | Occasional |
|--|----------|------------|
| On the sheet every night | Yes, as **going** | No — they apply per night |
| Skip a night | Send an **exchange request** | Not on the sheet |
| Cover a gap | — | Claim an invite, or apply to the waitlist |
| Pay | Prepaid contract (if the admin marked them prepaid) | Occasional rate to the admin if approved |

**Going rule:** a contract player counts as going until they send an exchange request. Then they are **out**. The person who covers them counts as going (this night only, or as the new contract player).

Admins can also add a contract player later by email, with optional **Prepaid all sessions**.

Cancel the whole season, or **Cancel night** on one date. Both hide from the event list.

---

## Exchange (can't make a contract night)

Only a contract player who is still **present** that night can send this.

| Choice | Who is asked | Credit |
|--------|----------------|--------|
| **Ask everyone** | All occasional members | If someone claims, they pay the **contract rate** to you |
| **Ask one member** | One occasional player you pick | Same |
| **Open the slot on the waitlist (no credit)** | Anyone can apply on the waitlist | You are **not** credited |

The person covering can:

- **Take this night only** — they are **Replacement · this night**. You stay on the season contract. Later nights are still yours.
- **Take over the contract** — they become the contract player from that night forward. You are off the remaining nights.

Both options post to **club chat**, the **notification inbox**, and **Telegram** (if the bot is linked).

A private ask still appears in chat (it names who was asked). Only that person can claim it from the night page. Everyone else just sees the chat line.

Waitlist without an invite: occasional players **Apply**. Admin approves. They pay the **occasional rate** to the admin. The absentee is not credited.

---

## Polls

Two kinds:

- **Time poll** on a pickup event — pick when to play, then the admin locks it
- **Club poll** — any club question (from the club home)

Members vote and can **suggest** an extra option (admin accepts it). Admins can override or delete votes and delete the poll. Suspended members cannot vote or open the voter list.

---

## Chat

Every club has a chat. Members (including suspended) can send messages, reply, and react (👍 ❤️ 😂 🔥 ⚽ 👏).

Exchange requests and claims also show up here as messages from the person who did them.

---

## Notifications

The bell opens a compact inbox (club photo, type icon, title, short body, relative time). Unread rows are highlighted. Tap a row to mark it read and open the related page. **Mark all as read** is at the top.

The same event is also queued for **Telegram**. WhatsApp uses the same pipeline but is off until it is wired up.

You only get Telegram DMs after:

1. The live site has the bot token and a public HTTPS URL
2. You tap **Start** on the bot from Profile

---

## Ledger

Club **Ledger** shows what you owe and what is owed to you (pending amounts).

Typical lines:

- Pickup cost split after the admin posts the total
- Occasional fee when a waitlist player is approved
- Replacement paying the contract player for that night
- Prepaid contract when an admin adds someone as prepaid

Admins see everyone’s entries. A collector or admin can **mark paid**. CountIn does not move money.

---

## Help

From Profile → **Help**: open a **Support** or **Feedback** ticket. You can reply until it is closed. Platform operators answer from a separate Ops site (not inside CountIn).

---

## Screens (where to tap)

| Place | What it is |
|-------|------------|
| `/` | Search clubs |
| `/app` | Your clubs |
| `/app/c/{club}` | Home: events, polls, season nights |
| `/app/c/{club}/events/{id}` | Pickup night |
| `/app/c/{club}/seasons/{id}` | Contract vote, rates, night list |
| `/app/c/{club}/sessions/{id}` | One season night (people, exchange, waitlist) |
| `/app/c/{club}/chat` | Club chat |
| `/app/c/{club}/members` | Squad, requests, owner actions |
| `/app/c/{club}/ledger` | Credits |
| `/app/c/{club}/notifications` | Inbox |
| `/app/c/{club}/settings` | Invite link, club details (owner) |
| `/app/profile` | You, Telegram, Help |

---

## Local demo (optional)

After `npm run dev` and `npx tsx scripts/seed.ts`:

| Person | Email | Password |
|--------|-------|----------|
| Alex (club owner) | `alex@club.com` | `password123` |
| Sam (member) | `sam@club.com` | `password123` |

Demo club: **Tuesday Night FC** → `/app/c/tuesday-night-fc`
