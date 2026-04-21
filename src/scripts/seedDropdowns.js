import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import DropdownOption, { DROPDOWN_TYPES } from '../models/DropdownOption.js';

const DEFAULT_OPTIONS = {
  channelName: [
    { label: 'Zatpat', value: 'Zatpat' },
    { label: 'MMK', value: 'MMK' },
    { label: 'Andromeda', value: 'Andromeda' },
    { label: 'Urban Money', value: 'Urban Money' },
    { label: '4B Network', value: '4B Network' },
    { label: 'Atul ICICI Ins', value: 'Atul ICICI Ins' },
    { label: 'Insurance', value: 'Insurance' },
  ],
  bankName: [
    { label: 'HDFC Bank', value: 'HDFC Bank' },
    { label: 'ICICI Bank', value: 'ICICI Bank' },
    { label: 'Axis Bank', value: 'Axis Bank' },
    { label: 'State Bank of India', value: 'State Bank of India' },
    { label: 'IDBI Bank', value: 'IDBI Bank' },
    { label: 'Kotak Mahindra Bank', value: 'Kotak Mahindra Bank' },
    { label: 'IndusInd Bank', value: 'IndusInd Bank' },
    { label: 'Bank of Baroda', value: 'Bank of Baroda' },
    { label: 'Canara Bank', value: 'Canara Bank' },
    { label: 'Union Bank of India', value: 'Union Bank of India' },
  ],
  referralName: [
    { label: 'Direct', value: 'Direct' },
    { label: 'Broker', value: 'Broker' },
    { label: 'Employee Referral', value: 'Employee Referral' },
    { label: 'Partner', value: 'Partner' },
    { label: 'Online Advertisement', value: 'Online Advertisement' },
  ],
  propertyType: [
    { label: 'Flat', value: 'Flat' },
    { label: 'Bungalow', value: 'Bungalow' },
    { label: 'Row House', value: 'Row House' },
    { label: 'Plot', value: 'Plot' },
    { label: 'Commercial Shop', value: 'Commercial Shop' },
    { label: 'Commercial Office', value: 'Commercial Office' },
    { label: 'Industrial', value: 'Industrial' },
    { label: 'Agricultural Land', value: 'Agricultural Land' },
  ],
  provisionalBank: [
    { label: 'HDFC Bank', value: 'HDFC Bank' },
    { label: 'ICICI Bank', value: 'ICICI Bank' },
    { label: 'Axis Bank', value: 'Axis Bank' },
    { label: 'State Bank of India', value: 'State Bank of India' },
  ],
};

async function seedDropdownOptions() {
  await connectDB();

  console.log('[seedDropdowns] Starting dropdown options seeding...');

  try {
    for (const [type, options] of Object.entries(DEFAULT_OPTIONS)) {
      const existingCount = await DropdownOption.countDocuments({ type });

      if (existingCount > 0) {
        console.log(`[seedDropdowns] Skipping ${type} - ${existingCount} options already exist`);
        continue;
      }

      for (let i = 0; i < options.length; i++) {
        const { label, value } = options[i];
        await DropdownOption.create({
          type,
          label,
          value,
          isActive: true,
          metadata: {
            description: '',
            sortOrder: i,
          },
        });
      }

      console.log(`[seedDropdowns] Seeded ${options.length} options for type: ${type}`);
    }

    console.log('[seedDropdowns] Dropdown options seeding completed successfully!');
  } catch (err) {
    console.error('[seedDropdowns] Error during seeding:', err);
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

seedDropdownOptions().catch((err) => {
  console.error('[seedDropdowns] failed:', err);
  process.exit(1);
});
