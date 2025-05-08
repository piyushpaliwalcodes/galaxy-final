import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Prompt from "@/app/models/video.models";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";

// Ensure DB connection

fal.config({
  credentials: process.env.NEXT_PUBLIC_FAL_API_KEY || process.env.FAL_API_KEY
});

export async function POST(request: NextRequest) {
  console.log("🔹 Starting video generation request process");
  try {
    console.log("🔹 Authenticating user...");
    const { userId } = await auth();
    if (!userId) {
      console.log("❌ Authentication failed: No userId provided");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`🔹 User authenticated: ${userId}`);

    console.log("🔹 Connecting to database...");
    try {
      await dbConnect();
      console.log("🔹 Database connection successful");
    } catch (dbError) {
      console.error("❌ Database connection failed:", dbError);
      return NextResponse.json(
        { error: "Database connection failed", message: dbError instanceof Error ? dbError.message : String(dbError) },
        { status: 500 }
      );
    }
    
    console.log("🔹 Parsing request body...");
    const body = await request.json();
    const { userPrompt, referenceVideoUrl, promptId, screenRatio } = body;
    console.log("🔹 Generation request details:", {
      promptId,
      screenRatio: screenRatio || "16:9",
      promptLength: userPrompt?.length || 0,
      videoUrlProvided: !!referenceVideoUrl
    });
    
    // Check for missing fields
    if (!userPrompt || !referenceVideoUrl) {
      console.error("❌ Missing required fields:", {
        hasUserPrompt: !!userPrompt,
        hasReferenceVideoUrl: !!referenceVideoUrl,
      });
      return NextResponse.json(
        { error: "Missing required fields: userPrompt or referenceVideoUrl" },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.NEXT_PUBLIC_FAL_API_KEY || process.env.FAL_API_KEY;
    if (!apiKey) {
      console.error("❌ Missing FAL API key");
      return NextResponse.json(
        { error: "Server configuration error: Missing API key" },
        { status: 500 }
      );
    }

    // Validate promptId if provided
    if (promptId) {
      console.log(`🔹 Validating promptId: ${promptId}`);
      try {
        const existingPrompt = await Prompt.findById(promptId);
        if (!existingPrompt) {
          console.warn(`⚠️ Prompt with ID ${promptId} not found in database`);
          // Continue anyway, as we'll create a new entry
        } else {
          console.log(`🔹 Found existing prompt: ${promptId}`);
        }
      } catch (promptError) {
        console.error(`❌ Error validating promptId: ${promptId}`, promptError);
        // Continue anyway, we'll try to update
      }
    }

    console.log("🔹 Submitting request to Fal.AI with parameters:", {
      model: "fal-ai/hunyuan-video/video-to-video",
      steps: 30,
      resolution: "720p",
      aspect_ratio: screenRatio || "16:9",
      strength: 0.85,
      safety_checker: true,
      webhook: !!process.env.VERCEL_URL
    });
    
    const startTime = Date.now();
    const { request_id } = await fal.queue.submit(
      "fal-ai/hunyuan-video/video-to-video",
      {
        input: { 
          prompt: userPrompt, 
          video_url: referenceVideoUrl,
          num_inference_steps: 30,
          aspect_ratio: screenRatio || "16:9",
          resolution: "720p",
          enable_safety_checker: true,
          strength: 0.85
       },
        webhookUrl: `${process.env.VERCEL_URL}/api/fal/webhook`,
      }
    );
    const requestTime = Date.now() - startTime;

    console.log(`🔹 Request submitted successfully in ${requestTime}ms:`, { 
      request_id,
      webhookUrl: process.env.VERCEL_URL ? `${process.env.VERCEL_URL}/api/fal/webhook` : "Not configured" 
    });

    console.log(`🔹 Updating prompt record with request ID: ${request_id}`);
    try {
      await Prompt.findByIdAndUpdate(promptId, { requestId: request_id });
      console.log(`🔹 Successfully updated prompt ${promptId} with request ID ${request_id}`);
    } catch (updateError) {
      console.error(`❌ Failed to update prompt ${promptId} with request ID:`, updateError);
      // Continue anyway, as the main request was successful
    }

    return NextResponse.json(
      { message: "Request submitted", requestId: request_id },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("❌ Error submitting request:", error);
    
    let errorMessage = "Unknown error";
    let errorDetails = {};
    
    if (error instanceof Error) {
      console.error("❌ Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      errorMessage = error.message;
      errorDetails = { name: error.name };
    } else {
      console.error("❌ Unknown error type:", typeof error);
      errorMessage = String(error);
    }
    
    // Check database connection state in error handler
    let dbStatus = "Unknown";
    try {
      if (mongoose.connections.length > 0) {
        const connectionState = mongoose.connections[0].readyState;
        console.error(`❌ Database connection state during error: ${connectionState}`);
        dbStatus = 
          connectionState === mongoose.ConnectionStates.connected ? "Connected" :
          connectionState === mongoose.ConnectionStates.connecting ? "Connecting" :
          connectionState === mongoose.ConnectionStates.disconnected ? "Disconnected" :
          connectionState === mongoose.ConnectionStates.disconnecting ? "Disconnecting" : "Unknown";
      } else {
        console.error("❌ No database connections available during error");
        dbStatus = "No connection";
      }
    } catch (dbError) {
      console.error("❌ Error checking database status:", dbError);
    }
    
    return NextResponse.json(
      { 
        error: "Failed to Generate Video",
        message: errorMessage,
        dbStatus,
        ...errorDetails
      },
      { status: 500 }
    );
  }
}