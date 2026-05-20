const mongoose = require('mongoose');

const storeSettingsSchema = new mongoose.Schema({
  gstPercentage: { type: Number, required: true, default: 18, min: 0 },
  shippingCharge: { type: Number, required: true, default: 49, min: 0 },
  freeShippingAbove: { type: Number, required: true, default: 499, min: 0 },
  codAvailable: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);
