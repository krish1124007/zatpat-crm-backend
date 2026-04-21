import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import User from '../models/User.js';

async function run() {
  await connectDB();

  const existing = await User.findOne({ email: env.seed.email });
  if (existing) {
    console.log(`[seed] SuperAdmin already exists: ${existing.email}`);
  } else {
    const user = await User.create({
      name: env.seed.name,
      email: env.seed.email,
      phone: env.seed.phone,
      password: env.seed.password,
      role: 'SuperAdmin',
      isActive: true,
    });
    console.log(`[seed] created SuperAdmin: ${user.email}`);
    console.log(`[seed] password: ${env.seed.password}  (change after first login)`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
