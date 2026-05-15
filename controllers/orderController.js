const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Razorpay = require('razorpay');
const crypto = require('crypto');

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

    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Shipping address is required' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Payment method is required' });
    }

    let formattedOrderItems;

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

        formattedOrderItems.push({
          product: product._id,
          name: product.name,
          image: product.images[0] || '',
          price: product.price,
          quantity: item.quantity || item.qty || 1
        });
      }
    } else {
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: 'Cart is empty' });
      }

      formattedOrderItems = cart.items
        .filter((item) => item.product != null)
        .map((item) => ({
          product: item.product._id,
          name: item.product.name,
          image: item.product.images?.[0] || '',
          price: item.price,
          quantity: item.quantity
        }));

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

    const shippingPrice = itemsPrice > 499 ? 0 : 49;
    const taxPrice = Math.round(itemsPrice * 0.05);
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

    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], totalAmount: 0 });

    if (paymentMethod === 'razorpay') {
      const razorpay = getRazorpayClient();
      const razorpayOrder = await razorpay.orders.create({
        amount: totalPrice * 100,
        currency: 'INR',
        receipt: order._id.toString()
      });
      return res.status(201).json({ success: true, order, razorpayOrder, key: process.env.RAZORPAY_KEY_ID });
    }

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
    const order = await Order.findByIdAndUpdate(orderId, {
      isPaid: true, paidAt: Date.now(), orderStatus: 'confirmed',
      paymentResult: { razorpay_order_id, razorpay_payment_id, razorpay_signature, status: 'paid' }
    }, { new: true });
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
