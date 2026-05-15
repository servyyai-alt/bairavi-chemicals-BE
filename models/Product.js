const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Product name is required'], trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  images: [{ type: String }],
  stock: { type: Number, required: true, default: 0 },

  // Chemical-specific fields
  unit: {
    type: String, default: 'kg',
    enum: ['kg', 'g', 'litre', 'ml', 'ton', 'bag', 'drum', 'can', 'bottle', 'pack']
  },
  casNumber: { type: String, default: '' },
  purity: { type: String, default: '' },
  grade: {
    type: String, default: 'industrial',
    enum: ['industrial', 'laboratory', 'analytical', 'pharmaceutical', 'food', 'reagent', 'technical']
  },
  packagingSize: { type: String, default: '' },
  molecularFormula: { type: String, default: '' },
  molecularWeight: { type: String, default: '' },
  appearance: { type: String, default: '' },
  hsn: { type: String, default: '' },
  gstRate: { type: Number, default: 18 },
  hazardClass: { type: String, default: '' },
  safetyData: {
    storageConditions: { type: String, default: '' },
    handlingPrecautions: { type: String, default: '' },
    ppe: { type: String, default: '' }
  },
  industries: [{ type: String }],
  applications: { type: String, default: '' },
  certifications: [{ type: String }],
  minOrderQty: { type: Number, default: 1 },
  bulkPriceBreaks: [{ minQty: Number, pricePerUnit: Number }],
  tags: [{ type: String }],
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  reviews: [reviewSchema],
  numReviews: { type: Number, default: 0 },
  rating: { type: Number, default: 0 }
}, { timestamps: true });

productSchema.pre('save', function (next) {
  if (this.reviews.length > 0) {
    this.numReviews = this.reviews.length;
    this.rating = this.reviews.reduce((acc, r) => acc + r.rating, 0) / this.reviews.length;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
