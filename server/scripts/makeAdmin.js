import mongoose from 'mongoose';
import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// User Schema (simplified version)
const userSchema = new mongoose.Schema({
  email: String,
  username: String,
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const makeAdmin = async () => {
  try {
    await connectDB();

    console.log('\n🛡️  SafeTalk - Make User Admin\n');
    console.log('═'.repeat(50));

    const identifier = await question('Enter username or email: ');

    if (!identifier) {
      console.log('❌ Username or email is required');
      process.exit(1);
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('\n📋 User Details:');
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current Role: ${user.role}`);

    if (user.role === 'admin') {
      console.log('\n⚠️  This user is already an admin!');
      const demote = await question('Do you want to demote to user? (yes/no): ');
      
      if (demote.toLowerCase() === 'yes') {
        user.role = 'user';
        await user.save();
        console.log('\n✅ User demoted to regular user successfully!');
      } else {
        console.log('\n❌ Operation cancelled');
      }
    } else {
      const confirm = await question('\nMake this user an admin? (yes/no): ');
      
      if (confirm.toLowerCase() === 'yes') {
        user.role = 'admin';
        await user.save();
        console.log('\n✅ User promoted to admin successfully!');
        console.log('\n🎉 The user can now access the admin panel at /admin');
      } else {
        console.log('\n❌ Operation cancelled');
      }
    }

    console.log('═'.repeat(50) + '\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Run the script
makeAdmin();
