import mongoose from 'mongoose';
import config from '../src/config/index.js';
import User from '../src/models/User.js';

const id = process.argv[2] || '68f65d1f86a894665a9afc66';

const main = async () => {
  try {
    console.log('Connecting to', config.mongodbUri);
    await mongoose.connect(config.mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected. Looking up user', id);

    const user = await User.findById(id).lean();
    if (!user) {
      console.log('User not found');
      process.exitCode = 2;
    } else {
      console.log('User found:');
      console.log({
        id: String(user._id),
        email: user.email,
        username: user.username,
        isActive: !!user.isActive,
        twoFAMethod: user.twoFAMethod,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      });
      process.exitCode = 0;
    }
  } catch (err) {
    console.error('Error checking user:', err.message || err);
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  }
};

main();
