import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';

const router = express.Router();

/**
 * Temporary debug endpoint
 * GET /api/debug/users/:id
 * Returns the user document as the server sees it and the current DB name.
 * This route is intentionally unprotected and should be removed after debugging.
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dbName = (mongoose.connection && mongoose.connection.db && mongoose.connection.db.databaseName) || null;

    const user = await User.findById(id).lean().select('-passwordHash -totpSecret');

    return res.status(200).json({
      success: true,
      debug: {
        dbName,
        userFound: !!user
      },
      user: user || null
    });
  } catch (err) {
    console.error('Debug route error:', err);
    return res.status(500).json({ success: false, message: 'Server debug error', error: err.message });
  }
});

export default router;
