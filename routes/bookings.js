const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/bookings - book seats for an event (concurrency-safe)
router.post('/', requireAuth, async (req, res) => {
  const { event_id, num_seats } = req.body;
  const seats = parseInt(num_seats, 10);

  if (!event_id || !seats || seats < 1) {
    return res.status(400).json({ error: 'Please provide a valid event and number of seats.' });
  }

  // This is the important part for an Event Booking System: two people booking
  // the last seat(s) at the same time must never both succeed. We use a real
  // DB transaction with a row lock (SELECT ... FOR UPDATE) so the seat count
  // is read and decremented atomically.
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM events WHERE id = ? FOR UPDATE',
      [event_id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Event not found.' });
    }

    const event = rows[0];
    if (event.available_seats < seats) {
      await connection.rollback();
      return res.status(409).json({ error: `Only ${event.available_seats} seat(s) left. Please choose fewer seats.` });
    }

    const [updateResult] = await connection.query(
      'UPDATE events SET available_seats = available_seats - ? WHERE id = ? AND available_seats >= ?',
      [seats, event_id, seats]
    );

    if (updateResult.affectedRows === 0) {
      // Someone else took the seat(s) between our SELECT and UPDATE
      await connection.rollback();
      return res.status(409).json({ error: 'Seats just got taken by someone else. Please try again.' });
    }

    const ticketId = 'TCKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const [bookingResult] = await connection.query(
      'INSERT INTO bookings (user_id, event_id, num_seats, status, ticket_id) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, event_id, seats, 'confirmed', ticketId]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Booking confirmed.',
      booking: {
        id: bookingResult.insertId,
        ticket_id: ticketId,
        event_title: event.title,
        num_seats: seats
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while booking. Please try again.' });
  } finally {
    connection.release();
  }
});

// GET /api/bookings/mine - the logged-in user's bookings
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.num_seats, b.status, b.ticket_id, b.created_at,
              e.id AS event_id, e.title, e.venue, e.event_date, e.price
       FROM bookings b JOIN events e ON b.event_id = e.id
       WHERE b.user_id = ? ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ bookings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load your bookings.' });
  }
});

// GET /api/bookings/:id/qrcode - generates a QR code (as data URL) for a ticket
router.get('/:id/qrcode', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });

    const booking = rows[0];
    const qrDataUrl = await QRCode.toDataURL(booking.ticket_id);
    res.json({ qrcode: qrDataUrl, ticket_id: booking.ticket_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate the QR code.' });
  }
});

// PUT /api/bookings/:id/cancel - cancel a booking and release the seats
router.put('/:id/cancel', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const booking = rows[0];
    if (booking.status === 'cancelled') {
      await connection.rollback();
      return res.status(400).json({ error: 'This booking is already cancelled.' });
    }

    await connection.query('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', booking.id]);
    await connection.query(
      'UPDATE events SET available_seats = available_seats + ? WHERE id = ?',
      [booking.num_seats, booking.event_id]
    );

    await connection.commit();
    res.json({ message: 'Booking cancelled and seats released.' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Could not cancel this booking.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
