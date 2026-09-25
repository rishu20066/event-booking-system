# VenueBook — Event Booking System

A full-stack event booking app: plain HTML/CSS/JS frontend, Node.js + Express backend, MySQL database.

## Features
- User signup/login with JWT auth (bcrypt-hashed passwords)
- Admin role: create, edit, delete events; view attendees per event
- Browse/search/filter events by category
- Book seats with **concurrency-safe** seat locking (MySQL transaction + `SELECT ... FOR UPDATE`), so two people can't overbook the last seat
- Ticket with a generated QR code
- Cancel a booking (seats are released back to the event)
- "My tickets" page with booking history

## Setup

1. **Install MySQL** if you don't have it, and make sure it's running.

2. **Install dependencies:**
   ```bash
   cd event-booking-system
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your MySQL credentials:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=event_booking
   JWT_SECRET=any_long_random_string
   ```

4. **Create the database** (tables are created automatically on first run, but the database itself needs to exist):
   ```bash
   mysql -u root -p -e "CREATE DATABASE event_booking;"
   ```
   (Optional: `schema.sql` is included if you'd rather run the CREATE TABLE statements yourself.)

5. **Run the server:**
   ```bash
   npm start
   ```
   On first run it auto-creates the `users`, `events`, and `bookings` tables, and seeds one admin account:
   - Email: `admin@events.com`
   - Password: `admin123`

6. **Open the app:** go to `http://localhost:5000` in your browser.

## How it works
- `server.js` — Express app, serves the `public/` frontend as static files and mounts the API routes
- `routes/auth.js` — register, login, current-user
- `routes/events.js` — public browse + admin CRUD
- `routes/bookings.js` — the booking/cancel logic, including the transaction-based seat lock
- `middleware/auth.js` — JWT verification + admin role check
- `public/` — the frontend pages, calling the API with `fetch()`

## The concurrency part (worth knowing for interviews)
When you book seats, the server:
1. Opens a MySQL transaction
2. Runs `SELECT * FROM events WHERE id = ? FOR UPDATE` — this locks the event row so no other booking can read/modify it until this transaction finishes
3. Checks there are enough seats, then `UPDATE`s `available_seats`
4. Commits (or rolls back on any failure)

This means if two users try to book the last seat at the same instant, the second one's transaction waits for the first to finish, sees the updated (lower) seat count, and gets a clear "not enough seats" response instead of both bookings succeeding.

## Next steps you could add
- Email confirmation on booking
- Payment integration (Razorpay/Stripe) before confirming a paid booking
- Pagination on the events list
- Image upload for events
