const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    budget: {
      type: Number,
      min: 0,
      default: null,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: {
      type: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
          },
          email: {
            type: String,
            trim: true,
            lowercase: true,
            default: '',
          },
          name: {
            type: String,
            trim: true,
            default: '',
          },
          role: {
            type: String,
            enum: ['owner', 'cohost', 'member'],
            default: 'member',
          },
          status: {
            type: String,
            enum: ['active', 'invited'],
            default: 'active',
          },
          inviteToken: {
            type: String,
            default: '',
          },
          inviteExpiresAt: {
            type: Date,
            default: null,
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', tripSchema);
