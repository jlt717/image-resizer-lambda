import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const S3 = new S3Client();
const DEST_BUCKET = process.env.DEST_BUCKET;
const THUMBNAIL_WIDTH = 200; 
const SUPPORTED_FORMATS = {
  jpg: true,
  jpeg: true,
  png: true,
};

export const handler = async (event, context) => {
  const { eventTime, s3 } = event.Records[0];
  const srcBucket = s3.bucket.name;
  const srcKey = decodeURIComponent(s3.object.key.replace(/\+/g, " "));

  // Check if the image is already resized to avoid recursion
  if (srcKey.startsWith("resized-images/")) {
    console.log(`Image ${srcBucket}/${srcKey} is already resized. Skipping.`);
    return;
  }

  const ext = srcKey.replace(/^.*\./, "").toLowerCase();

  console.log(`${eventTime} - ${srcBucket}/${srcKey}`);

  if (!SUPPORTED_FORMATS[ext]) {
    console.log(`ERROR: Unsupported file type (${ext})`);
    return;
  }

  // Get the image from the source bucket
  try {
    const { Body, ContentType } = await S3.send(
      new GetObjectCommand({
        Bucket: srcBucket,
        Key: srcKey,
      })
    );
    const image = await Body.transformToByteArray();
    // resize image
    const outputBuffer = await sharp(image).resize(THUMBNAIL_WIDTH).toBuffer();

     // Define the prefix based on whether it's an original or resized image
     const prefix = srcKey.startsWith("original-images/") ? "original-images/" : "resized-images/";

     // Create the destination key with the appropriate prefix
     const destKey = `${prefix}${srcKey}`;
     
    // store new image in the destination bucket with a prefix
    //const destKey = `resized-images/${srcKey}`;
    await S3.send(
      new PutObjectCommand({
        Bucket: DEST_BUCKET,
        Key: destKey,
        Body: outputBuffer,
        ContentType,
      })
    );
    
    console.log(`Successfully resized ${srcBucket}/${srcKey} and uploaded to ${DEST_BUCKET}/${destKey}`);
  } catch (error) {
    console.log(error);
  }
};

