const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  icon: { type: String, default: '🧪' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  // Chemical category specific
  chemicalType: {
    type: String, default: 'general',
    enum: ['industrial', 'laboratory', 'water_treatment', 'cleaning', 'solvent', 'acid', 'alkali', 'specialty', 'agro', 'raw_material', 'general']
  }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
