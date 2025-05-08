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
    
    // Debug log for Vercel environment
    console.log("🔹 Environment variables:", {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      hasVercelUrl: !!process.env.VERCEL_URL,
      vercelUrl: process.env.VERCEL_URL,
      hasApiKey: !!process.env.FAL_API_KEY,
      apiKeyLength: process.env.FAL_API_KEY ? process.env.FAL_API_KEY.length : 0
    });
    
    console.log("🔹 Generation request details:", {
      promptId,
      screenRatio: screenRatio || "16:9",
      promptLength: userPrompt?.length || 0,
      videoUrlProvided: !!referenceVideoUrl,
      videoUrlLength: referenceVideoUrl?.length || 0,
      videoUrlPrefix: referenceVideoUrl?.substring(0, 20) + "..." || ""
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
    
    // Validate reference video URL format
    if (referenceVideoUrl) {
      try {
        const url = new URL(referenceVideoUrl);
        console.log("🔹 Reference video URL validation:", {
          protocol: url.protocol,
          host: url.host,
          isHttps: url.protocol === "https:",
          hasValidProtocol: url.protocol === "http:" || url.protocol === "https:"
        });
        
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          console.error("❌ Invalid video URL protocol:", url.protocol);
          return NextResponse.json(
            { error: "Invalid video URL protocol. Must be http or https." },
            { status: 400 }
          );
        }
      } catch (urlError) {
        console.error("❌ Invalid video URL format:", urlError);
        return NextResponse.json(
          { error: "Invalid video URL format" },
          { status: 400 }
        );
      }
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

    // Prepare webhook URL
    let webhookUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/fal/webhook` : undefined;
    
    // If we're in development or no VERCEL_URL, try to construct from request
    if (!webhookUrl && process.env.NODE_ENV === "development") {
      try {
        const host = request.headers.get('host');
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        if (host) {
          webhookUrl = `${protocol}://${host}/api/fal/webhook`;
          console.log(`🔹 Constructed webhook URL from request headers: ${webhookUrl}`);
        }
      } catch (headerError) {
        console.warn(`⚠️ Could not construct webhook URL from headers:`, headerError);
      }
    }

    console.log("🔹 Submitting request to Fal.AI with parameters:", {
      model: "fal-ai/hunyuan-video/video-to-video",
      steps: 30,
      resolution: "720p",
      aspect_ratio: screenRatio || "16:9",
      strength: 0.85,
      safety_checker: true,
      webhook: webhookUrl || "Not configured",
      prompt_length: userPrompt.length,
      video_url_valid: !!referenceVideoUrl
    });
    
    // Prepare the request payload
    const requestPayload = {
      input: { 
        prompt: userPrompt, 
        video_url: referenceVideoUrl,
        num_inference_steps: 30,
        aspect_ratio: screenRatio || "16:9",
        resolution: "720p",
        enable_safety_checker: true,
        strength: 0.85
      },
      webhookUrl
    };
    
    // Filter out undefined values from webhookUrl
    if (!webhookUrl) {
      delete requestPayload.webhookUrl;
      console.log("🔹 Webhook URL not provided, removed from request payload");
    }
    
    console.log("🔹 Full request payload:", JSON.stringify({
      ...requestPayload,
      input: {
        ...requestPayload.input,
        prompt: userPrompt.length > 20 ? userPrompt.substring(0, 20) + "..." : userPrompt,
        video_url: referenceVideoUrl.length > 20 ? referenceVideoUrl.substring(0, 20) + "..." : referenceVideoUrl
      }
    }, null, 2));
    
    const startTime = Date.now();
    try {
      const { request_id } = await fal.queue.submit(
        "fal-ai/hunyuan-video/video-to-video",
        requestPayload
      );
      const requestTime = Date.now() - startTime;

      console.log(`🔹 Request submitted successfully in ${requestTime}ms:`, { 
        request_id,
        webhookUrl
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
    } catch (apiError) {
      console.error("❌ Fal.AI API error:", apiError);
      
      // Extract API error response
      let apiErrorMessage = "Unknown API error";
      let apiErrorBody = {};
      let apiErrorStatus = 500;
      
      if (apiError && typeof apiError === 'object') {
        if ('status' in apiError) {
          apiErrorStatus = (apiError as any).status || 500;
        }
        if ('body' in apiError) {
          apiErrorBody = (apiError as any).body || {};
          console.error("❌ API error body:", JSON.stringify(apiErrorBody, null, 2));
        }
        if ('message' in apiError) {
          apiErrorMessage = (apiError as any).message || "Unknown API error";
        }
      }
      
      console.error(`❌ Fal.AI API rejected request with status ${apiErrorStatus}: ${apiErrorMessage}`);
      
      return NextResponse.json(
        { 
          error: "Fal.AI API rejected request", 
          message: apiErrorMessage,
          details: apiErrorBody,
          status: apiErrorStatus
        },
        { status: apiErrorStatus }
      );
    }
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