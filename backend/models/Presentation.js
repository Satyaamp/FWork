const mongoose = require('mongoose');

const PresentationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  businessTypes: {
    type: [String],
    required: true,
    default: ['Other']
  },
  presentationType: {
    type: String,
    enum: ['pdf', 'image', 'video'],
    required: true
  },
  thumbnail: {
    type: String,
    trim: true,
    default: ''
  },
  file: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  createdBy: {
    name: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    }
  },
  createdAtUTC: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Presentation', PresentationSchema);
