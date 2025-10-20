import mongoose from 'mongoose';
import config from '../src/config/index.js';
import User from '../src/models/User.js';
import { generateAccessToken } from '../src/utils/jwt.js';

const id = process.argv[2];
if (!id) {
  console.error('Usage: node server/scripts/generateToken.js <userId>');
  process.exit(2);
}

const main = async () => {
  try {
    console.log('Connecting to', config.mongodbUri);
    await mongoose.connect(config.mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });

    const user = await User.findById(id).lean();
    if (!user) {
      console.error('User not found');
      process.exitCode = 2;
      return;
    }

    const payload = {
      userId: String(user._id),
      email: user.email,
      role: user.role
    };

    const token = generateAccessToken(payload);
    console.log('\nAccess token (use in Authorization header):\n');
    console.log(token);
    console.log('\nExample curl:');
    console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:5000/api/users/${id}`);

    process.exitCode = 0;
  } catch (err) {
    console.error('Error generating token:', err.message || err);
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  }
};

main();
