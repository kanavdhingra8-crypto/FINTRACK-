const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
  },
  expenseThreshold: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

module.exports = mongoose.model('UserSettings', userSettingsSchema);
