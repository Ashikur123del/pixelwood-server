require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: '*', 
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
}));
app.use(express.json());

const uri = process.env.MONGODB_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  
  try {
    await client.connect();
    // 🎯 আপনার নতুন ডাটাবেজ নাম 'PixelWood' এখানে সেট করা আছে
    const db = client.db('PixelWood'); 
    cachedDb = db;
    console.log("Connected to MongoDB Atlas (PixelWood)");
    return db;
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw error;
  }
}

// Root Route
app.get('/', (req, res) => {
  res.json({ message: 'Server is live and running' });
});

// ==========================================
// SITE VIEWS ENDPOINTS
// ==========================================
app.post("/views/increment", async (req, res) => {
  try {
    const database = await connectToDatabase();
    const collection = database.collection("site_views");

    await collection.updateOne(
      { identifier: "total_views" },
      { $inc: { count: 1 } },
      { upsert: true }
    );

    const updatedDoc = await collection.findOne({ identifier: "total_views" });
    res.status(200).json({ success: true, count: updatedDoc ? updatedDoc.count : 1 });
  } catch (error) {
    console.error("View Increment Error:", error);
    res.status(500).json({ success: false, error: "Failed to increment view" });
  }
});

app.get("/views", async (req, res) => {
  try {
    const database = await connectToDatabase();
    const collection = database.collection("site_views");

    const result = await collection.findOne({ identifier: "total_views" });
    res.json({ count: result ? result.count : 0 });
  } catch (error) {
    console.error("Get Views Error:", error);
    res.status(500).json({ success: false, error: "Could not fetch views" });
  }
});

// ==========================================
// ORDERS ENDPOINTS (TARGETING PIXELWOOD COLLECTION)
// ==========================================

// 1. POST: নতুন অর্ডার সরাসরি 'Pixelwood' কালেকশনে সেভ হবে
app.post("/orders", async (req, res) => {
  try {
    const database = await connectToDatabase();
    // ✅ পুরানো 'destinations' পরিবর্তন করে 'Pixelwood' কালেকশন করা হলো
    const collection = database.collection("Pixelwood"); 

    const offset = new Date().getTimezoneOffset() * 60000;
    const localDate = new Date(Date.now() - offset).toISOString().split('T')[0];

    const orderData = {
      ...req.body,
      orderDate: localDate 
    };

    const result = await collection.insertOne(orderData);
    res.status(201).json({ ...orderData, _id: result.insertedId });
  } catch (error) {
    console.error("POST Error:", error);
    res.status(500).json({ success: false, error: "Failed to save data" });
  }
});

// 2. GET: 'Pixelwood' কালেকশন থেকে সব ডেটা নিয়ে আসবে
app.get("/orders", async (req, res) => {
  try {
    const database = await connectToDatabase();
    // ✅ কালেকশনের নাম পরিবর্তন করে 'Pixelwood' করা হলো
    const collection = database.collection("Pixelwood"); 
    const result = await collection.find().toArray();
    res.json(result);
  } catch (error) {
    console.error("GET Error:", error);
    res.status(500).json({ success: false, error: "Could not fetch data" });
  }
});

// 3. GET Single: আইডি দিয়ে নির্দিষ্ট একটি অর্ডার খুঁজবে 'Pixelwood' থেকে
app.get("/orders/:id", async (req, res) => {
  try {
    const database = await connectToDatabase();
    // ✅ কালেকশনের নাম পরিবর্তন করে 'Pixelwood' করা হলো
    const collection = database.collection("Pixelwood");
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const result = await collection.findOne({ _id: new ObjectId(id) });
    if (!result) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("GET Single Order Error:", error);
    res.status(500).json({ success: false, error: "Could not fetch order" });
  }
});

// 4. PATCH: আইডি অনুযায়ী 'Pixelwood' কালেকশনের অর্ডার আপডেট করবে
app.patch("/orders/:id", async (req, res) => {
  try {
    const database = await connectToDatabase();
    // ✅ কালেকশনের নাম পরিবর্তন করে 'Pixelwood' করা হলো
    const collection = database.collection("Pixelwood");
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const { _id, ...updatedFields } = req.body;

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedFields }
    );
    res.json(result);
  } catch (error) {
    console.error("PATCH Error:", error);
    res.status(500).json({ success: false, error: "Update failed" });
  }
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running locally on port ${port}`);
  });
}