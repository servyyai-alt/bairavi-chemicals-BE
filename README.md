# Sri Bairavi Chemicals – Backend

Express + MongoDB API for the Sri Bairavi Chemicals e-commerce platform.

## Stack
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- Cloudinary (image uploads)
- Razorpay (payment)

## Setup

```bash
npm install
cp .env.example .env    # fill in all env vars
npm run seed            # optional: seed categories & sample products
npm run dev
```

## New Chemical Fields in Product Schema

| Field | Type | Description |
|---|---|---|
| `casNumber` | String | CAS Registry Number (e.g. 7647-14-5) |
| `purity` | String | Purity percentage (e.g. 99.5%) |
| `grade` | Enum | industrial / laboratory / analytical / pharmaceutical / reagent / technical |
| `packagingSize` | String | e.g. "25 kg bag, 50 kg bag" |
| `molecularFormula` | String | e.g. NaCl |
| `molecularWeight` | String | e.g. 58.44 g/mol |
| `hsn` | String | HSN code for GST |
| `gstRate` | Number | GST percentage (default 18) |
| `hazardClass` | String | Safety hazard class |
| `safetyData` | Object | Storage, handling, PPE |
| `industries` | [String] | Target industries |
| `applications` | String | Use cases |
| `certifications` | [String] | ISO, GMP etc. |
| `minOrderQty` | Number | Minimum order quantity |
