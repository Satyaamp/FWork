const mongoose = require('mongoose');

const DeletedMslSchema = new mongoose.Schema({
  mslCode: {
    type: String,
    required: true
  },
  mslname: {
    type: String,
    required: true,
    trim: true
  },
  ownerName: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  fullAddress: {
    type: String,
    required: true
  },
  area: String,
  city: String,
  state: String,
  country: String,
  pincode: String,
  notes: {
    type: String,
    trim: true
  },
  addedBy: {
    name: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    }
  },
  activeFlag: {
    type: String,
    default: 'N',
    enum: ['A', 'N']
  },
  createdAtUTC: {
    type: Date
  },
  createdAtIST: {
    type: Date
  },
  deletedDateTime: {
    type: Date,
    default: Date.now
  },
  deletedBy: {
    name: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    }
  }
});

module.exports = mongoose.model('DeletedMsl', DeletedMslSchema, 'deletemsl');
