require("dotenv").config();

const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const cors = require("cors");

const saveLog = require("./services/dynamoService");

const app = express();
app.use(cors());
app.use(express.json());

// AWS CONFIG
AWS.config.update({
  region: process.env.AWS_REGION
});

const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3();

const upload = multer({ storage: multer.memoryStorage() });

const COLLECTION_ID = process.env.COLLECTION_ID;
const BUCKET_NAME = process.env.BUCKET_NAME;

// ========================
// Health Check
// ========================
app.get("/", (req, res) => {
  res.send("Face Recognition Backend Running 🚀");
});

// ========================
// INDEX FACE
// ========================
app.post("/index-face", upload.single("image"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const fileName = Date.now() + "-" + req.file.originalname;

    // Upload to S3
    await s3.upload({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }).promise();

    // Index face
    const params = {
      CollectionId: COLLECTION_ID,
      Image: {
        S3Object: {
          Bucket: BUCKET_NAME,
          Name: fileName
        }
      },
      ExternalImageId: req.body.name,
      DetectionAttributes: []
    };

    const data = await rekognition.indexFaces(params).promise();

    res.json({
      message: "Face indexed successfully",
      faceId: data.FaceRecords[0]?.Face?.FaceId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Indexing failed", details: err.message });
  }
});

// ========================
// SEARCH FACE (WITH DYNAMODB LOGGING)
// ========================
app.post("/search-face", upload.single("image"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const fileName = Date.now() + "-" + req.file.originalname;

    // Upload to S3
    await s3.upload({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }).promise();

    // Search face
    const params = {
      CollectionId: COLLECTION_ID,
      Image: {
        S3Object: {
          Bucket: BUCKET_NAME,
          Name: fileName
        }
      },
      FaceMatchThreshold: 85,
      MaxFaces: 1
    };

    const data = await rekognition.searchFacesByImage(params).promise();

    if (data.FaceMatches.length > 0) {

      const match = data.FaceMatches[0];

      const logData = {
        LogId: Date.now().toString(),
        Name: match.Face.ExternalImageId,
        Similarity: match.Similarity,
        FaceId: match.Face.FaceId,
        ImageKey: fileName,
        Timestamp: new Date().toISOString()
      };

      // Save to DynamoDB
      await saveLog(logData);

      res.json({
        match: match.Face.ExternalImageId,
        similarity: match.Similarity
      });

    } else {
      res.json({ message: "No match found" });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed", details: err.message });
  }
});

// ========================
app.listen(3000, () => {
  console.log("Server running on port 3000");
});