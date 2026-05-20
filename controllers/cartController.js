const Cart = require('../models/Cart');
const Product = require('../models/Product');

const getDefaultVariant = (product) => product.variants?.find((variant) => variant.stock > 0) || product.variants?.[0] || null;
const getVariantBySize = (product, selectedSize) => (
  product.variants?.find((variant) => variant.size === selectedSize) || null
);

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'name images price stock unit variants slug');
    if (!cart) return res.json({ success: true, cart: { items: [], totalAmount: 0 } });
    res.json({ success: true, cart });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, selectedSize } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const variant = selectedSize ? getVariantBySize(product, selectedSize) : getDefaultVariant(product);
    if (!variant) return res.status(400).json({ success: false, message: 'Please select a valid size' });

    const requestedQuantity = Number(quantity || 1);
    const normalizedQuantity = Math.max(Number(variant.moq || 1), requestedQuantity);

    if (variant.stock < normalizedQuantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock for selected size' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });

    const linePrice = Number(variant.offerPrice || 0) > 0 && Number(variant.offerPrice) < Number(variant.price)
      ? Number(variant.offerPrice)
      : Number(variant.price);
    const originalPrice = Number(variant.offerPrice || 0) > 0 && Number(variant.offerPrice) < Number(variant.price)
      ? Number(variant.price)
      : 0;

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId && item.selectedSize === variant.size
    );

    if (existingItem) {
      if (variant.stock < existingItem.quantity + normalizedQuantity) {
        return res.status(400).json({ success: false, message: 'Insufficient stock for selected size' });
      }
      existingItem.quantity += normalizedQuantity;
      existingItem.price = linePrice;
      existingItem.originalPrice = originalPrice;
      existingItem.moq = Number(variant.moq || 1);
    } else {
      cart.items.push({
        product: productId,
        selectedSize: variant.size,
        quantity: normalizedQuantity,
        price: linePrice,
        originalPrice,
        moq: Number(variant.moq || 1)
      });
    }
    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.product', 'name images price stock unit variants slug');
    res.json({ success: true, cart: updatedCart });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    const item = cart.items.find(i => i._id.toString() === req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    const product = await Product.findById(item.product);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const variant = getVariantBySize(product, item.selectedSize) || getDefaultVariant(product);
    if (!variant) return res.status(400).json({ success: false, message: 'Selected size is no longer available' });

    const moq = Number(item.moq || variant.moq || 1);

    if (quantity <= 0) {
      cart.items = cart.items.filter(i => i._id.toString() !== req.params.itemId);
    } else {
      if (quantity < moq) {
        return res.status(400).json({ success: false, message: `Minimum order quantity for ${item.selectedSize} is ${moq}` });
      }
      if (quantity > Number(variant.stock || 0)) {
        return res.status(400).json({ success: false, message: `Only ${variant.stock} item(s) left for ${item.selectedSize}` });
      }
      item.quantity = quantity;
      item.price = Number(variant.offerPrice || 0) > 0 && Number(variant.offerPrice) < Number(variant.price)
        ? Number(variant.offerPrice)
        : Number(variant.price);
      item.originalPrice = Number(variant.offerPrice || 0) > 0 && Number(variant.offerPrice) < Number(variant.price)
        ? Number(variant.price)
        : 0;
    }
    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.product', 'name images price stock unit variants slug');
    res.json({ success: true, cart: updatedCart });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    cart.items = cart.items.filter(i => i._id.toString() !== req.params.itemId);
    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.product', 'name images price stock unit variants slug');
    res.json({ success: true, cart: updatedCart });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], totalAmount: 0 });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
