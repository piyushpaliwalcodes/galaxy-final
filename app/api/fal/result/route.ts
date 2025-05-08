import { NextRequest, NextResponse } from "next/server";
import Prompt from "@/app/models/video.models";
import dbConnect from "@/lib/db";
import { fal } from "@fal-ai/client";
import axios from "axios";

 // Ensure DB connection

// post request to fetch the transformed video from the fal.ai queue
export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json();
        const { requestId } = body;

        if (!requestId) {
            return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
        }

        const response = await fal.queue.result("fal-ai/hunyuan-video/video-to-video", {
            requestId
          });
     

        const prompt = await Prompt.findOne({ requestId });
        if (!prompt) {
            return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
        }

       return NextResponse.json({ message: "Video fetched successfully", response}, { status: 200 });

    } catch (error) {
        console.error("❌ Error fetching transformed video:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}