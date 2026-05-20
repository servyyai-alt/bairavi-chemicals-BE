const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const StoreSettings = require('../models/StoreSettings');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const getDefaultVariant = (product) => product.variants?.find((variant) => variant.stock > 0) || product.variants?.[0] || null;
const getVariantBySize = (product, selectedSize) => (
  product.variants?.find((variant) => variant.size === selectedSize) || null
);
const getVariantLinePrice = (variant) => (
  Number(variant.offerPrice || 0) > 0 && Number(variant.offerPrice) < Number(variant.price)
    ? Number(variant.offerPrice)
    : Number(variant.price)
);
const getVariantOriginalPrice = (variant) => (
  Number(variant.offerPrice || 0) > 0 && Number(variant.offerPrice) < Number(variant.price)
    ? Number(variant.price)
    : 0
);
const shouldFinalizeOrderOnCreate = (paymentMethod) => paymentMethod !== 'razorpay';
const getStoreSettings = async () => {
  let settings = await StoreSettings.findOne();
  if (!settings) {
    settings = await StoreSettings.create({
      gstPercentage: 18,
      shippingCharge: 49,
      freeShippingAbove: 499,
      codAvailable: true
    });
  }
  return settings;
};

const getRazorpayClient = () => {
  const missing = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const error = new Error(`Missing Razorpay environment variables: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

exports.createOrder = async (req, res) => {
  try {
    console.log('Create order request received', {
      userId: req.user?._id,
      paymentMethod: req.body?.paymentMethod,
      orderItemsCount: req.body?.orderItems?.length || 0
    });

    const { shippingAddress, paymentMethod, notes, orderItems } = req.body;
    const settings = await getStoreSettings();

    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Shipping address is required' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Payment method is required' });
    }

    if (paymentMethod === 'cod' && !settings.codAvailable) {
      return res.status(400).json({ success: false, message: 'Cash on Delivery is currently unavailable' });
    }

    let formattedOrderItems;
    const reservedProducts = new Map();
    const finalizeOnCreate = shouldFinalizeOrderOnCreate(paymentMethod);

    if (orderItems && orderItems.length > 0) {
      formattedOrderItems = [];
      for (const item of orderItems) {
        if (!item.product) {
          throw new Error('Product ID is missing in order item');
        }

        const product = await Product.findById(item.product);
        if (!product) {
          throw new Error(`Product not found: ${item.product}`);
        }

        const variant = item.selectedSize ? getVariantBySize(product, item.selectedSize) : getDefaultVariant(product);
        if (!variant) {
          throw new Error(`Selected size is unavailable for product: ${product.name}`);
        }

        const quantity = Math.max(Number(variant.moq || 1), Number(item.quantity || item.qty || 1));

        if (quantity > Number(variant.stock || 0)) {
          throw new Error(`Only ${variant.stock} item(s) left for ${product.name} - ${variant.size}`);
        }

        if (finalizeOnCreate) {
          variant.stock = Number(variant.stock || 0) - quantity;
          reservedProducts.set(product._id.toString(), product);
        }

        formattedOrderItems.push({
          product: product._id,
          name: product.name,
          image: product.images[0] || '',
          selectedSize: variant.size,
          price: getVariantLinePrice(variant),
          originalPrice: getVariantOriginalPrice(variant),
          quantity
        });
      }
    } else {
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: 'Cart is empty' });
      }

      formattedOrderItems = [];

      for (const item of cart.items.filter((cartItem) => cartItem.product != null)) {
        const product = await Product.findById(item.product._id || item.product);
        if (!product) {
          continue;
        }

        const variant = item.selectedSize ? getVariantBySize(product, item.selectedSize) : getDefaultVariant(product);
        if (!variant) {
          throw new Error(`Selected size is unavailable for product: ${product.name}`);
        }

        if (Number(item.quantity || 0) < Number(variant.moq || 1)) {
          throw new Error(`Minimum order quantity for ${product.name} - ${variant.size} is ${variant.moq}`);
        }

        if (Number(item.quantity || 0) > Number(variant.stock || 0)) {
          throw new Error(`Only ${variant.stock} item(s) left for ${product.name} - ${variant.size}`);
        }

        if (finalizeOnCreate) {
          variant.stock = Number(variant.stock || 0) - Number(item.quantity || 0);
          reservedProducts.set(product._id.toString(), product);
        }

        formattedOrderItems.push({
          product: product._id,
          name: product.name,
          image: product.images?.[0] || '',
          selectedSize: variant.size,
          price: getVariantLinePrice(variant),
          originalPrice: getVariantOriginalPrice(variant),
          quantity: item.quantity
        });
      }

      if (formattedOrderItems.length === 0) {
        return res.status(400).json({ success: false, message: 'All products in cart are no longer available' });
      }
    }

    let itemsPrice;
    if (orderItems && orderItems.length > 0) {
      itemsPrice = formattedOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    } else {
      const cart = await Cart.findOne({ user: req.user._id });
      itemsPrice = cart ? cart.totalAmount : 0;
    }

    const shippingPrice = itemsPrice >= Number(settings.freeShippingAbove || 0)
      ? 0
      : Number(settings.shippingCharge || 0);
    const taxPrice = Math.round(itemsPrice * (Number(settings.gstPercentage || 0) / 100));
    const totalPrice = itemsPrice + shippingPrice + taxPrice;

    const order = await Order.create({
      user: req.user._id,
      orderItems: formattedOrderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      shippingPrice,
      taxPrice,
      totalPrice,
      notes
    });

    if (paymentMethod === 'razorpay') {
      const razorpay = getRazorpayClient();
      const razorpayOrder = await razorpay.orders.create({
        amount: totalPrice * 100,
        currency: 'INR',
        receipt: order._id.toString()
      });
      order.paymentResult = {
        razorpay_order_id: razorpayOrder.id,
        status: 'created'
      };
      await order.save();
      return res.status(201).json({ success: true, order, razorpayOrder, key: process.env.RAZORPAY_KEY_ID });
    }

    await Promise.all(
      Array.from(reservedProducts.values()).map((product) => product.save())
    );

    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], totalAmount: 0 });

    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('Order creation failed', {
      message: err.message,
      stack: err.stack
    });
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Missing Razorpay environment variable: RAZORPAY_KEY_SECRET' });
    }

    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(sign).digest('hex');
    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.isPaid) {
      return res.json({ success: true, order });
    }

    const reservedProducts = new Map();

    for (const item of order.orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found for order item: ${item.name}` });
      }

      const variant = item.selectedSize ? getVariantBySize(product, item.selectedSize) : getDefaultVariant(product);
      if (!variant) {
        return res.status(400).json({ success: false, message: `Selected size is unavailable for product: ${item.name}` });
      }

      if (Number(item.quantity || 0) > Number(variant.stock || 0)) {
        return res.status(400).json({ success: false, message: `Only ${variant.stock} item(s) left for ${item.name} - ${variant.size}` });
      }

      variant.stock = Number(variant.stock || 0) - Number(item.quantity || 0);
      reservedProducts.set(product._id.toString(), product);
    }

    await Promise.all(
      Array.from(reservedProducts.values()).map((product) => product.save())
    );

    order.isPaid = true;
    order.paidAt = Date.now();
    order.orderStatus = 'confirmed';
    order.paymentResult = { razorpay_order_id, razorpay_payment_id, razorpay_signature, status: 'paid' };
    await order.save();

    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], totalAmount: 0 });

    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('orderItems.product')
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.cancelMyOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (['shipped', 'delivered', 'cancelled'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'This order can no longer be cancelled' });
    }

    order.orderStatus = 'cancelled';
    await order.save();

    res.json({ success: true, order, message: 'Order cancelled successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteMyOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.orderStatus !== 'cancelled') {
      return res.status(400).json({ success: false, message: 'Only cancelled orders can be deleted' });
    }

    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cancelled orders cannot be updated' });
    }

    const update = { orderStatus };
    if (orderStatus === 'delivered') update.deliveredAt = Date.now();
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, order: updatedOrder });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const [totalOrders, totalUsers, totalProducts, recentOrders, revenue] = await Promise.all([
      Order.countDocuments(),
      require('../models/User').countDocuments({ role: 'user' }),
      Product.countDocuments({ isActive: true }),
      Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(5),
      Order.aggregate([
        { $match: { orderStatus: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ])
    ]);
    res.json({ success: true, stats: { totalOrders, totalUsers, totalProducts, totalRevenue: revenue[0]?.total || 0, recentOrders } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
