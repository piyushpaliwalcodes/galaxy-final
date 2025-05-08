import { NextResponse, NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import Prompt from '@/app/models/video.models';
import { auth } from '@clerk/nextjs/server';
import { uploadVideoToCloudinary } from '@/utils/cloudinary';

 // Connect to the database

function getScreenRatio(width: number, height: number): string {
  const aspectRatio = width / height;
  
  // If width is greater than height (landscape)
  if (aspectRatio > 1) {
    return "16:9";
  }
  // If height is greater than width (portrait) 
  else {
    return "9:16";
  }
}



export async function POST(request: NextRequest) {
    console.log("You are here for now");
    if (request.method !== 'POST') {
        return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized: can't upload the video, login first" }, { status: 401 });
    }

    try {
        await dbConnect(); // Connect to the database
        const formData = await request?.formData();
        const referenceVideoUrl = formData.get('referenceVideoUrl') as string
        const prompt = formData.get('prompt');
        
        // Upload video to Cloudinary
        const cloudinaryUpload = await uploadVideoToCloudinary(referenceVideoUrl);
        
        // Check if cloudinaryUpload is null
        if (!cloudinaryUpload) {
            return NextResponse.json({ error: "Failed to upload video to Cloudinary" }, { status: 500 });
        }
        
        // Check if secure_url exists
        if (!cloudinaryUpload.secure_url) {
            return NextResponse.json({ error: "Cloudinary did not return a valid URL" }, { status: 500 });
        }
        
        const cloudinaryUploadUrl = cloudinaryUpload.secure_url; 
        
        // creating a collection in the database.
        const newPrompt = await Prompt.create({
            userId,
            prompt,
            referenceVideoUrl: cloudinaryUploadUrl,
        });

        if (!newPrompt) {
            console.log("Checking if code was here"); 
            return NextResponse.json({ error: "Failed to upload the video" }, { status: 400 });
        }
        
        // Get screen ratio, provide default values in case height or width are missing
        const width = cloudinaryUpload.width || 1920;
        const height = cloudinaryUpload.height || 1080;
        const screenRatio = getScreenRatio(height, width);

        return NextResponse.json({ message: "Video uploaded successfully", prompt: newPrompt, screenRatio: screenRatio }, { status: 200 });
    } catch (error: unknown) {
        console.error("Error in upload-user-video API:", error);
        if (error instanceof Error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        } else {
            return NextResponse.json({ error: "An unexpected error occurred during upload" }, { status: 500 });
        }
    }
}