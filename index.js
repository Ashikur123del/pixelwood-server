require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5000;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors({
  origin: '*', 
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
}));
app.use(express.json());

app.use('/uploads', express.static(uploadDir));

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
    const db = client.db('PixelWood'); 
    cachedDb = db;
    console.log("Connected to MongoDB Atlas (PixelWood)");
    return db;
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw error;
  }
}


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); 
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); 
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Shudhu matro images allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } 
});


app.get('/', (req, res) => {
  res.json({ message: 'Server is live and running successfully' });
});


app.post("/api/slider-images", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Kono file select kora hoyni!" });
    }

    const database = await connectToDatabase();
    const collection = database.collection("slider_images"); 

    const imagePath = `/uploads/${req.file.filename}`;
    const newImageDoc = {
      imageUrl: imagePath,
      createdAt: new Date()
    };

    const result = await collection.insertOne(newImageDoc);
    res.status(201).json({ success: true, _id: result.insertedId, imageUrl: imagePath });
  } catch (error) {
    console.error("Upload Endpoint Error:", error);
    res.status(500).json({ success: false, error: error.message || "Image save korte somossa hoyeche" });
  }
});

app.get("/api/slider-images", async (req, res) => {
  try {
    const database = await connectToDatabase();
    const collection = database.collection("slider_images");
    const images = await collection.find().sort({ createdAt: -1 }).toArray();
    res.json(images);
  } catch (error) {
    console.error("GET Slider Images Error:", error);
    res.status(500).json({ success: false, error: "Could not fetch images" });
  }
});


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



app.post("/orders", async (req, res) => {
  try {
    const database = await connectToDatabase();
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

app.get("/orders", async (req, res) => {
  try {
    const database = await connectToDatabase();
    const collection = database.collection("Pixelwood"); 
    const result = await collection.find().toArray();
    res.json(result);
  } catch (error) {
    console.error("GET Error:", error);
    res.status(500).json({ success: false, error: "Could not fetch data" });
  }
});

app.get("/orders/:id", async (req, res) => {
  try {
    const database = await connectToDatabase();
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

app.patch("/orders/:id", async (req, res) => {
  try {
    const database = await connectToDatabase();
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

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: `Multer Error: ${err.message}` });
  }
  res.status(500).json({ success: false, error: err.message });
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running locally on port ${port}`);
  });
}       