const AWS = require("aws-sdk");

const dynamo = new AWS.DynamoDB.DocumentClient();

const saveLog = async (logData) => {
  await dynamo.put({
    TableName: "FaceRecognitionLogs",
    Item: logData
  }).promise();
};

module.exports = saveLog;