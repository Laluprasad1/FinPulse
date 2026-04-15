const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      trim: true,
      required: true,
    },
    period: {
      type: String,
      enum: ['monthly', 'weekly'],
      required: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'All',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Budget', budgetSchema);
