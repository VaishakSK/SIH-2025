const mongoose = require('mongoose');

function generateReportId() {
  return 'R' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
}

// description word count validator: 30 - 250 words
function wordCount(val) {
  if (!val) return false;
  const words = val.trim().split(/\s+/).filter(Boolean);
  return words.length >= 30 && words.length <= 250;
}

// title validator: max 10 words, non-empty
function titleWordLimit(val) {
  if (!val) return false;
  const words = val.trim().split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 10;
}

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
    default: generateReportId
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    validate: {
      validator: titleWordLimit,
      message: 'Title must be 1–10 words'
    }
  },
  imagePath: { type: String, required: true }, // relative path under /uploads
  department: { type: String, required: [true, 'Department is required'], trim: true },
  address: { type: String, required: [true, 'Address is required'], trim: true },
  locationText: { type: String, trim: true }, // human readable from geotag
  status: { type: String, enum: ['open','in_progress','resolved','closed'], default: 'open' },
  description: {
    type: String,
    required: [true, 'Description is required'],
    validate: {
      validator: wordCount,
      message: 'Description must be between 30 and 250 words'
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);