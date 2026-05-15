const Category = require('../models/Category');

exports.getCategories = async (req, res) => {
  try {
    const query = { isActive: true };
    const categories = await Category.find(query).sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, categories });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAllCategoriesAdmin = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, categories });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createCategory = async (req, res) => {
  try {
    const slug = req.body.name.toLowerCase().replace(/\s+/g, '-');
    const category = await Category.create({ ...req.body, slug });
    res.status(201).json({ success: true, category });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateCategory = async (req, res) => {
  try {
    const update = { ...req.body };

    if (update.name) {
      update.slug = update.name.toLowerCase().trim().replace(/\s+/g, '-');
    }

    const category = await Category.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, category });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, message: 'Category deleted permanently' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
