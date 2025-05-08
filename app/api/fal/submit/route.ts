import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Prompt from "@/app/models/video.models";
import dbConnect from "@/lib/db";

 // Ensure DB connection



fal.config({
  credentials: process.env.NEXT_PUBLIC_FAL_API_KEY || process.env.FAL_API_KEY
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    
    await dbConnect();
    const body = await request.json();
    const { userPrompt, referenceVideoUrl, promptId, screenRatio} = body;
    console.log("🔹Generation Request received:", {
      userPrompt,
      referenceVideoUrl,
      promptId,
    });
    // Check for missing fields
    if (!userPrompt || !referenceVideoUrl) {
      console.error("Missing required fields:", {
        userPrompt,
        referenceVideoUrl,
      });
      return NextResponse.json(
        { error: "Missing required fields: userPrompt or referenceVideoUrl" },
        { status: 400 }
      );
    }

    console.log("🔹 Submitting request to Fal.AI...");
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

    console.log("Request submitted successfully:", request_id);

    await Prompt.findByIdAndUpdate(promptId, { requestId: request_id });

    return NextResponse.json(
      { message: "Request submitted", requestId: request_id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error submitting request:", error);
    return NextResponse.json(
      { error: "Failed to Generate Video" },
      { status: 500 }
    );
  }
}