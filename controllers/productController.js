const Product = require('../models/Product');

exports.getProducts = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, rating, sort, page = 1, limit = 12, featured } = req.query;
    const query = { isActive: true };

    if (category) query.category = category;
    if (featured === 'true') query.isFeatured = true;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
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
    const slug = req.body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const product = await Product.create({ ...req.body, slug });
    res.status(201).json({ success: true, product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const mongoose = require('mongoose');

exports.updateProduct = async (req, res) => {
  try {
    const data = { ...req.body };

    // ✅ FIX CATEGORY TYPE CONVERSION
    if (data.category) {
      data.category = new mongoose.Types.ObjectId(data.category);
    }

    // ✅ FIX EMPTY IMAGES CLEANUP
    if (data.images) {
      data.images = data.images.filter(Boolean);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    console.error("🔥 UPDATE PRODUCT ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
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
