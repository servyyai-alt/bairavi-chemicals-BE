const mongoose = require('mongoose');

const VARIANT_SIZES = ['500 ml', '1 Litre', '2 Litre', '5 Litre', '7 Litre', '10 Litre', '20 Litre', '50 Litre'];

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true }
}, { timestamps: true });

const variantSchema = new mongoose.Schema({
  size: { type: String, required: true, enum: VARIANT_SIZES },
  price: { type: Number, required: true, min: 0 },
  offerPrice: { type: Number, default: 0, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  moq: { type: Number, min: 1, default: 1 }
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Product name is required'], trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, required: true },
  shortDescription: { type: String, default: '' },
  longDescription: { type: String, default: '' },
  sku: { type: String, default: '', trim: true },
  brandName: { type: String, default: 'Sri Bairavi Chemicals', trim: true },
  price: { type: Number, required: true, min: 0 },
  offerPrice: { type: Number, default: 0, min: 0 },
  originalPrice: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  images: [{ type: String }],
  stock: { type: Number, required: true, default: 0 },
  variants: {
    type: [variantSchema],
    validate: {
      validator: (variants) => Array.isArray(variants) && variants.length > 0,
      message: 'At least one product variant is required'
    }
  },

  // Chemical-specific fields
  unit: {
    type: String, default: 'variant',
    enum: ['kg', 'g', 'litre', 'ml', 'ton', 'bag', 'drum', 'can', 'bottle', 'pack', 'variant']
  },
  availability: {
    type: String,
    enum: ['in_stock', 'out_of_stock'],
    default: 'in_stock'
  },
  casNumber: { type: String, default: '' },
  purity: { type: String, default: '' },
  grade: {
    type: String, default: 'industrial',
    enum: ['industrial', 'laboratory', 'analytical', 'pharmaceutical', 'food', 'reagent', 'technical']
  },
  packagingSize: { type: String, default: '' },
  color: { type: String, default: '' },
  fragranceType: { type: String, default: '' },
  productType: { type: String, default: '' },
  shelfLife: { type: String, default: '' },
  storageCondition: { type: String, default: '' },
  ingredients: { type: String, default: '' },
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
  if (Array.isArray(this.variants) && this.variants.length > 0) {
    const defaultVariant = this.variants.find((variant) => variant.stock > 0) || this.variants[0];
    const totalStock = this.variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);

    this.stock = totalStock;
    this.packagingSize = this.variants.map((variant) => variant.size).join(', ');
    this.minOrderQty = defaultVariant?.moq || 1;
    this.availability = totalStock > 0 ? 'in_stock' : 'out_of_stock';
    this.unit = 'variant';

    if (defaultVariant) {
      const hasOfferPrice = Number(defaultVariant.offerPrice || 0) > 0 && Number(defaultVariant.offerPrice) < Number(defaultVariant.price);
      this.price = hasOfferPrice ? Number(defaultVariant.offerPrice) : Number(defaultVariant.price);
      this.offerPrice = hasOfferPrice ? Number(defaultVariant.offerPrice) : 0;
      this.originalPrice = hasOfferPrice ? Number(defaultVariant.price) : 0;
      this.discount = hasOfferPrice && Number(defaultVariant.price) > 0
        ? Math.round(((Number(defaultVariant.price) - Number(defaultVariant.offerPrice)) / Number(defaultVariant.price)) * 100)
        : 0;
    }
  }

  if (this.reviews.length > 0) {
    this.numReviews = this.reviews.length;
    this.rating = this.reviews.reduce((acc, r) => acc + r.rating, 0) / this.reviews.length;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
module.exports.VARIANT_SIZES = VARIANT_SIZES;
