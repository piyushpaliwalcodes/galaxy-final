import { v2 as cloudinary } from "cloudinary";

// Ensure required environment variables are present
if (!process.env.CLOUDINARY_CLOUD_NAME || 
    !process.env.CLOUDINARY_API_KEY || 
    !process.env.CLOUDINARY_API_SECRET) {
  console.error("Missing required Cloudinary environment variables");
}

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a video to Cloudinary and returns its secure URL
 * @param videoUrl - The URL or base64 string of the video to upload
 * @param retries - Number of retry attempts (default: 3)
 * @param delay - Delay between retries in milliseconds (default: 1000)
 * @returns Promise with secure URL string or null if upload fails
 */
export async function uploadVideoToCloudinary(
  videoUrl: string, 
  retries = 3, 
  delay = 1000
): Promise<any | null> {
  // Input validation
  if (!videoUrl) {
    console.error("uploadVideoToCloudinary: No video URL provided");
    return null;
  }
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Uploading video to Cloudinary (Attempt ${attempt}/${retries})...`);
      
      const startTime = Date.now();
      const cloudinaryUpload = await cloudinary.uploader.upload(videoUrl, {
        resource_type: "video",
        timeout: 60000, // 60 second timeout for large videos
      });
      const uploadDuration = Date.now() - startTime;
      
      if (!cloudinaryUpload || !cloudinaryUpload.secure_url) {
        throw new Error("Invalid response from Cloudinary upload");
      }
      
      console.log(`Video upload successful (${uploadDuration}ms) - URL: ${cloudinaryUpload.secure_url}`);
      return cloudinaryUpload; // Return the secure URL of the uploaded video
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : String(error);
        
      console.error(
        `Attempt ${attempt}/${retries}: Error uploading video to Cloudinary - ${errorMessage}`,
        error instanceof Error && error.stack ? `\nStack: ${error.stack}` : ''
      );
      
      if (attempt < retries) {
        const waitTime = delay * attempt; // Exponential backoff
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        console.error("Maximum retry attempts reached. Upload failed.");
      }
    }
  }
  
  return null; // Return null if all retries fail
}