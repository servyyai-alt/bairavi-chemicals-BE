const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');

const CATEGORIES = [
  { name: 'Industrial Chemicals', slug: 'industrial-chemicals', icon: '🏭', description: 'Bulk industrial-grade chemicals for manufacturing processes', chemicalType: 'industrial' },
  { name: 'Laboratory Chemicals', slug: 'laboratory-chemicals', icon: '🔬', description: 'High-purity reagents for research and analytical work', chemicalType: 'laboratory' },
  { name: 'Water Treatment', slug: 'water-treatment', icon: '💧', description: 'Chemicals for water purification and treatment plants', chemicalType: 'water_treatment' },
  { name: 'Cleaning Chemicals', slug: 'cleaning-chemicals', icon: '🧹', description: 'Industrial cleaning and sanitation solutions', chemicalType: 'cleaning' },
  { name: 'Solvents', slug: 'solvents', icon: '🫙', description: 'Pure solvents for industrial and laboratory use', chemicalType: 'solvent' },
  { name: 'Acids & Alkalis', slug: 'acids-alkalis', icon: '⚗️', description: 'High-purity acids and bases', chemicalType: 'acid' },
  { name: 'Specialty Chemicals', slug: 'specialty-chemicals', icon: '✨', description: 'Specialty compounds for specific applications', chemicalType: 'specialty' },
  { name: 'Raw Materials', slug: 'raw-materials', icon: '📦', description: 'Unprocessed raw materials for chemical synthesis', chemicalType: 'raw_material' },
];

const seedDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Admin user
  const adminExists = await User.findOne({ email: 'admin@sribairavichemicals.com' });
  if (!adminExists) {
    const hash = await bcrypt.hash('admin123', 10);
    await User.create({ name: 'Admin', email: 'admin@sribairavichemicals.com', password: hash, role: 'admin' });
    console.log('Admin created');
  }

  // Categories
  await Category.deleteMany({});
  const cats = await Category.insertMany(CATEGORIES);
  console.log('Categories seeded:', cats.length);

  // Sample products
  await Product.deleteMany({});
  const products = [
    {
      name: 'Sodium Chloride (NaCl)', slug: 'sodium-chloride-nacl',
      description: 'High purity sodium chloride suitable for industrial, water treatment, and food processing applications.',
      price: 12, originalPrice: 15, stock: 500, unit: 'kg',
      category: cats[0]._id, casNumber: '7647-14-5', purity: '99.5%',
      grade: 'industrial', molecularFormula: 'NaCl', molecularWeight: '58.44 g/mol',
      appearance: 'White crystalline powder', packagingSize: '25 kg, 50 kg bags',
      hsn: '25010019', gstRate: 5, industries: ['Water Treatment', 'Food Processing', 'Textile'],
      certifications: ['ISO 9001'], isFeatured: true, isActive: true,
      images: ['https://images.unsplash.com/photo-1581093458791-9d42e3c7e117?w=400&q=80']
    },
    {
      name: 'Hydrochloric Acid (HCl)', slug: 'hydrochloric-acid-hcl',
      description: 'Technical grade hydrochloric acid used in metal pickling, pH control, and chemical synthesis.',
      price: 18, originalPrice: 22, stock: 200, unit: 'litre',
      category: cats[5]._id, casNumber: '7647-01-0', purity: '33%',
      grade: 'technical', molecularFormula: 'HCl', molecularWeight: '36.46 g/mol',
      appearance: 'Colourless to pale yellow liquid', packagingSize: '35 kg carboy, 250 kg drum',
      hazardClass: 'Corrosive (Class 8)', hsn: '28061010', gstRate: 18,
      safetyData: {
        storageConditions: 'Store in cool, well-ventilated area away from alkalis.',
        handlingPrecautions: 'Avoid contact with skin and eyes. Use in fume hood.',
        ppe: 'Acid-resistant gloves, face shield, chemical apron'
      },
      industries: ['Metal Processing', 'Textile', 'Chemical Synthesis'],
      certifications: ['ISO 9001'], isFeatured: true, isActive: true,
      images: ['https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&q=80']
    },
    {
      name: 'Sodium Hypochlorite (NaOCl)', slug: 'sodium-hypochlorite',
      description: 'Used as a disinfectant, bleaching agent, and water treatment chemical.',
      price: 8, stock: 1000, unit: 'litre',
      category: cats[2]._id, casNumber: '7681-52-9', purity: '10-12%',
      grade: 'industrial', molecularFormula: 'NaOCl',
      packagingSize: '30 litre can, 250 litre drum',
      hsn: '28281000', gstRate: 18,
      industries: ['Water Treatment', 'Hospital Sanitation', 'Swimming Pools'],
      isFeatured: true, isActive: true,
      images: ['https://images.unsplash.com/photo-1614308457932-e66f9d8e2bc2?w=400&q=80']
    },
    {
      name: 'Isopropyl Alcohol (IPA)', slug: 'isopropyl-alcohol-ipa',
      description: 'High-purity isopropanol for laboratory, pharmaceutical, and electronic cleaning applications.',
      price: 95, stock: 150, unit: 'litre',
      category: cats[4]._id, casNumber: '67-63-0', purity: '99.9%',
      grade: 'laboratory', molecularFormula: 'C3H8O', molecularWeight: '60.10 g/mol',
      appearance: 'Colourless liquid with alcoholic odour', packagingSize: '1 litre, 5 litre, 25 litre',
      hazardClass: 'Flammable Liquid (Class 3)', hsn: '29051220', gstRate: 18,
      safetyData: {
        storageConditions: 'Keep away from heat and ignition sources. Store in cool area.',
        handlingPrecautions: 'Keep away from open flames. Ensure adequate ventilation.',
        ppe: 'Nitrile gloves, safety glasses'
      },
      industries: ['Electronics', 'Pharmaceutical', 'Laboratory', 'Cosmetics'],
      certifications: ['ISO 9001', 'GMP'], isFeatured: true, isActive: true,
      images: ['https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&q=80']
    },
  ];
  await Product.insertMany(products);
  console.log('Products seeded:', products.length);

  mongoose.connection.close();
  console.log('Seed complete!');
};

seedDB().catch(console.error);
