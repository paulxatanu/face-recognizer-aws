const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

AWS.config.update({
  region: "ap-south-1"
});

const rekognition = new AWS.Rekognition();
const upload = multer({ storage: multer.memoryStorage() });

const COLLECTION_ID = "face-collection";

// Health check
app.get("/", (req, res) => {
  res.send("Face Recognition Backend Running 🚀");
});

// INDEX FACE
app.post("/index-face", upload.single("image"), async (req, res) => {
  try {
    const params = {
      CollectionId: COLLECTION_ID,
      Image: {
        Bytes: req.file.buffer
      },
      ExternalImageId: req.body.name,
      DetectionAttributes: []
    };

    const data = await rekognition.indexFaces(params).promise();

    res.json({
      message: "Face indexed successfully",
      faceId: data.FaceRecords[0].Face.FaceId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});
// SEARCH FACE
app.post("/search-face", upload.single("image"), async (req, res) => {
  try {
    const params = {
      CollectionId: COLLECTION_ID,
      Image: {
        Bytes: req.file.buffer
      },
      FaceMatchThreshold: 85,
      MaxFaces: 1
    };

    const data = await rekognition.searchFacesByImage(params).promise();

    if (data.FaceMatches.length > 0) {
      res.json({
        match: data.FaceMatches[0].Face.ExternalImageId,
        similarity: data.FaceMatches[0].Similarity
      });
    } else {
      res.json({
        message: "No match found"
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});
app.listen(3000, () => {
  console.log("Server running on port 3000");
});