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

const RESIZED_IMAGES_PREFIX = "resized-images/"; // Prefix for resized images

export const handler = async (event, context) => {
  const { eventTime, s3 } = event.Records[0];
  const srcBucket = s3.bucket.name;
  const srcKey = decodeURIComponent(s3.object.key.replace(/\+/g, " "));

  // Check if the image is already resized to avoid recursion
  if (srcKey.startsWith(RESIZED_IMAGES_PREFIX)) {
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

    
    // Create the destination key with the appropriate prefix
    const destKey = `${RESIZED_IMAGES_PREFIX}${srcKey
      .replace(/^.*\/original-images\//, "")
      .replace(/^original-images\//, "")}`;

    // store new image in the destination bucket with a prefix
  
    await S3.send(
      new PutObjectCommand({
        Bucket: DEST_BUCKET,
        Key: destKey,
        Body: outputBuffer,
        ContentType,
      })
    );

    console.log(
      `Successfully resized ${srcBucket}/${srcKey} and uploaded to ${DEST_BUCKET}/${destKey}`
    );
  } catch (error) {
    console.log(error);
  }
};
