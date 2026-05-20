const StoreSettings = require('../models/StoreSettings');

const DEFAULT_SETTINGS = {
  gstPercentage: 18,
  shippingCharge: 49,
  freeShippingAbove: 499,
  codAvailable: true
};

const getOrCreateSettings = async () => {
  let settings = await StoreSettings.findOne();
  if (!settings) {
    settings = await StoreSettings.create(DEFAULT_SETTINGS);
  }
  return settings;
};

exports.getStoreSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStoreSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    settings.gstPercentage = Number(req.body.gstPercentage ?? settings.gstPercentage);
    settings.shippingCharge = Number(req.body.shippingCharge ?? settings.shippingCharge);
    settings.freeShippingAbove = Number(req.body.freeShippingAbove ?? settings.freeShippingAbove);
    settings.codAvailable = Boolean(req.body.codAvailable);

    await settings.save();

    res.json({ success: true, settings });
  } catch (err) {
    const statusCode = err.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};
