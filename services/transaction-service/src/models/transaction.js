const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  note: {
    type: String,
    trim: true,
    maxlength: 500,
  },
}, {
  timestamps: true,
  versionKey: false,
});

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, category: 1, date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
