const mongoose = require('mongoose');

const PasswordHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  resetBy: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    }
  },
  password: {
    type: String,
    required: true
  },
  resetCount: {
    type: Number,
    required: true,
    default: 1
  },
  modifiedOn: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PasswordHistory', PasswordHistorySchema, 'passwordhistory');
