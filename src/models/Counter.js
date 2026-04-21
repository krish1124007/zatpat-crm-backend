import mongoose from 'mongoose';

// Atomic auto-increment counter (one document per named sequence).
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // sequence name
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

export async function nextSeq(name) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

export default Counter;
