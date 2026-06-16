require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 5000;

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

// Cloudinary Storage Setup (লোকাল ফোল্ডারের বদলে ক্লাউড স্টোরেজ)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'pixelwood_images',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage: storage });

app.use(cors({
  origin: true, 
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

const uri = process.env.MONGODB_URL;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  try {
    await client.connect();
    cachedDb = client.db('PixelWood');
    console.log("✅ Connected to MongoDB Atlas (PixelWood)");
    return cachedDb;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    throw error;
  }
}

// --- API Routes ---

app.get('/', (req, res) => res.json({ message: 'Server is live' }));

// Pixel Config
app.get('/api/pixel-config', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const config = await db.collection("pixel_settings").findOne({ identifier: "fb_pixel" });
    res.status(200).json({ success: true, pixelId: config ? config.pixelId : process.env.FACEBOOK_PIXEL_ID });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/pixel-config', async (req, res) => {
  try {
    const { pixelId } = req.body;
    const db = await connectToDatabase();
    await db.collection("pixel_settings").updateOne(
      { identifier: "fb_pixel" },
      { $set: { pixelId: pixelId.trim(), updatedAt: new Date() } },
      { upsert: true }
    );
    res.status(200).json({ success: true, message: "Pixel ID saved" });
  } catch (error) { res.status(500).json({ success: false }); }
});

// Slider Images (Updated to Cloudinary)
app.post("/api/slider-images", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file selected!" });
    const db = await connectToDatabase();
    // req.file.path এখন সরাসরি Cloudinary URL দিবে
    const imageUrl = req.file.path; 
    const result = await db.collection("slider_images").insertOne({ imageUrl, createdAt: new Date() });
    res.status(201).json({ success: true, _id: result.insertedId, imageUrl });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get("/api/slider-images", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const images = await db.collection("slider_images").find().sort({ createdAt: -1 }).toArray();
    res.json(images);
  } catch (error) { res.status(500).json({ success: false }); }
});

// Views & Orders (আগের মতোই)
app.post("/views/increment", async (req, res) => {
  try {
    const db = await connectToDatabase();
    await db.collection("site_views").updateOne({ identifier: "total_views" }, { $inc: { count: 1 } }, { upsert: true });
    const doc = await db.collection("site_views").findOne({ identifier: "total_views" });
    res.status(200).json({ success: true, count: doc.count });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.get("/views", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const resDoc = await db.collection("site_views").findOne({ identifier: "total_views" });
    res.json({ count: resDoc ? resDoc.count : 0 });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.post("/orders", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const orderData = { ...req.body, orderDate: new Date().toISOString().split('T')[0] };
    const result = await db.collection("Pixelwood").insertOne(orderData);
    res.status(201).json({ ...orderData, _id: result.insertedId });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.get("/orders", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection("Pixelwood").find().toArray();
    res.json(result);
  } catch (error) { res.status(500).json({ success: false }); }
});

app.get("/orders/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection("Pixelwood").findOne({ _id: new ObjectId(req.params.id) });
    res.json(result);
  } catch (error) { res.status(500).json({ success: false }); }
});

app.patch("/orders/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { _id, ...updatedFields } = req.body;
    await db.collection("Pixelwood").updateOne({ _id: new ObjectId(req.params.id) }, { $set: updatedFields });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.use((req, res) => res.status(404).json({ success: false, error: "Route not found" }));
app.use((err, req, res, next) => res.status(500).json({ success: false, error: err.message }));

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

module.exports = app;