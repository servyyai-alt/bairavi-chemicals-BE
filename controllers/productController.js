const Product = require('../models/Product');
const mongoose = require('mongoose');

const buildSlug = (value = '') => String(value)
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9-]/g, '');

const normalizeVariants = (variants = []) => {
  if (!Array.isArray(variants)) return [];

  return variants
    .map((variant) => ({
      size: String(variant.size || '').trim(),
      price: Number(variant.price || 0),
      offerPrice: Number(variant.offerPrice || 0),
      stock: Number(variant.stock || 0),
      moq: Math.max(1, Number(variant.moq || 1))
    }))
    .filter((variant) => variant.size && variant.price > 0);
};

const normalizeProductPayload = (body) => {
  const data = { ...body };

  if (data.category) {
    data.category = new mongoose.Types.ObjectId(data.category);
  }

  if (Array.isArray(data.images)) {
    data.images = data.images.filter(Boolean);
  }

  data.variants = normalizeVariants(data.variants);

  const defaultVariant = data.variants.find((variant) => variant.stock > 0) || data.variants[0];
  const totalStock = data.variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);

  data.shortDescription = (data.shortDescription || data.description || '').trim();
  data.longDescription = (data.longDescription || '').trim();
  data.description = data.shortDescription;
  data.brandName = (data.brandName || 'Sri Bairavi Chemicals').trim();
  data.sku = (data.sku || '').trim();
  data.packagingSize = data.variants.map((variant) => variant.size).join(', ');
  data.color = (data.color || '').trim();
  data.fragranceType = (data.fragranceType || '').trim();
  data.productType = (data.productType || '').trim();
  data.shelfLife = (data.shelfLife || '').trim();
  data.storageCondition = (data.storageCondition || data.storageConditions || '').trim();
  data.ingredients = (data.ingredients || '').trim();
  data.stock = totalStock;
  data.minOrderQty = defaultVariant?.moq || 1;
  data.availability = totalStock > 0 ? 'in_stock' : 'out_of_stock';
  data.unit = 'variant';

  if (defaultVariant) {
    const hasOfferPrice = Number(defaultVariant.offerPrice || 0) > 0 && Number(defaultVariant.offerPrice) < Number(defaultVariant.price);
    data.price = hasOfferPrice ? Number(defaultVariant.offerPrice) : Number(defaultVariant.price);
    data.offerPrice = hasOfferPrice ? Number(defaultVariant.offerPrice) : 0;
    data.originalPrice = hasOfferPrice ? Number(defaultVariant.price) : 0;
    data.discount = hasOfferPrice && Number(defaultVariant.price) > 0
      ? Math.round(((Number(defaultVariant.price) - Number(defaultVariant.offerPrice)) / Number(defaultVariant.price)) * 100)
      : 0;
  }

  data.safetyData = {
    ...(data.safetyData || {}),
    storageConditions: data.storageCondition,
    handlingPrecautions: data.safetyData?.handlingPrecautions || data.handlingPrecautions || '',
    ppe: data.safetyData?.ppe || data.ppe || ''
  };

  return data;
};

exports.getProducts = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, rating, sort, page = 1, limit = 12, featured } = req.query;
    const query = { isActive: true };

    if (category) query.category = category;
    if (featured === 'true') query.isFeatured = true;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { shortDescription: { $regex: search, $options: 'i' } },
      { longDescription: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { brandName: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (rating) query.rating = { $gte: Number(rating) };

    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') sortObj = { price: 1 };
    else if (sort === 'price_desc') sortObj = { price: -1 };
    else if (sort === 'rating') sortObj = { rating: -1 };
    else if (sort === 'name') sortObj = { name: 1 };

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name slug')
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({ success: true, products, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate('category', 'name slug').populate('reviews.user', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createProduct = async (req, res) => {
  try {
    const slug = buildSlug(req.body.name);
    const product = await Product.create({ ...normalizeProductPayload(req.body), slug });
    res.status(201).json({ success: true, product });
  } catch (err) {
    const statusCode = err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const data = normalizeProductPayload(req.body);
    if (req.body.name) {
      data.slug = buildSlug(req.body.name);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    console.error('UPDATE PRODUCT ERROR:', err);
    const statusCode = err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addReview = async (req, res) => {
  try {
    // ✅ Supports both routes: /:id/reviews (params) AND /review (body)
    const productId = req.params.id || req.body.productId;
    const { rating, comment = '' } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    const existingReview = product.reviews.find(
      r => r.user.toString() === req.user._id.toString()
    );

    if (existingReview) {
      // ✅ UPDATE existing review
      existingReview.rating = Number(rating);
      existingReview.comment = comment;
    } else {
      // ✅ CREATE new review
      product.reviews.push({
        user: req.user._id,
        name: req.user.name,
        rating: Number(rating),
        comment
      });
    }

    // ✅ Recalculate average rating
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, item) => acc + item.rating, 0) / product.reviews.length;

    await product.save();

    res.json({ success: true, message: existingReview ? "Review updated" : "Review added" });

  } catch (err) { 
    console.error("🔥 REVIEW ERROR:", err);
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.getAllProductsAdmin = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).populate('category', 'name').sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getMyReview = async (req, res) => {  
  try {    
    const product = await Product.findById(req.params.id);    
    const review = product.reviews.find(
      r => r.user.toString() === req.user._id.toString()
    );    
    res.json({
      success: true,
      review: review || null
    });
  } catch (err) {    
    res.status(500).json({ success: false, message: err.message });  
  }
};
