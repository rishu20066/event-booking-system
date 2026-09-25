const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/events - public list, newest events first, only upcoming by default
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = 'SELECT * FROM events WHERE event_date >= NOW()';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND (title LIKE ? OR venue LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY event_date ASC';

    const [rows] = await pool.query(sql, params);
    res.json({ events: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load events.' });
  }
});

// GET /api/events/:id - single event detail
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load this event.' });
  }
});

// POST /api/events - admin only, create event
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, category, venue, event_date, total_seats, price } = req.body;
    if (!title || !venue || !event_date || !total_seats) {
      return res.status(400).json({ error: 'Title, venue, date and total seats are required.' });
    }

    const [result] = await pool.query(
      `INSERT INTO events (title, description, category, venue, event_date, total_seats, available_seats, price, organizer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || '', category || 'general', venue, event_date, total_seats, total_seats, price || 0, req.user.id]
    );

    res.status(201).json({ id: result.insertId, message: 'Event created.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create the event.' });
  }
});

// PUT /api/events/:id - admin only, edit event
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, category, venue, event_date, price } = req.body;
    await pool.query(
      `UPDATE events SET title = ?, description = ?, category = ?, venue = ?, event_date = ?, price = ?
       WHERE id = ?`,
      [title, description, category, venue, event_date, price, req.params.id]
    );
    res.json({ message: 'Event updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update the event.' });
  }
});

// DELETE /api/events/:id - admin only
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Event deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete the event.' });
  }
});

// GET /api/events/:id/attendees - admin only, who booked this event
router.get('/:id/attendees', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.num_seats, b.status, b.ticket_id, u.name, u.email
       FROM bookings b JOIN users u ON b.user_id = u.id
       WHERE b.event_id = ? ORDER BY b.created_at DESC`,
      [req.params.id]
    );
    res.json({ attendees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load attendees.' });
  }
});

module.exports = router;
