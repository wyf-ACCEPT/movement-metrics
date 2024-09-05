const AWS = require('aws-sdk')
require('dotenv').config()

AWS.config.update({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY,
  secretAccessKey: process.env.AWS_S3_SECRET_KEY,
  region: process.env.AWS_S3_REGION,
});

const s3 = new AWS.S3();

function uploadToS3(fileContent, bucketName, key) {
  const params = {
    Bucket: bucketName, 
    Key: key, 
    Body: fileContent, 
    ContentType: 'text/plain',
  }

  s3.upload(params, (err, data) => {
    if (err) {
      console.error('Error uploading file: ', err);
    } else {
      console.log('File uploaded successfully at: ', data.Location);
    }
  })
}

const fileContent = 'Hello, CloudFront!'
const bucketName = 'movement-dashboard-240905'
const fileName = 'test/hello.txt'

uploadToS3(fileContent, bucketName, fileName);
