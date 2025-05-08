import { NextRequest, NextResponse } from "next/server";
import Prompt from "@/app/models/video.models";
import dbConnect from "@/lib/db";
import { uploadVideoToCloudinary } from '@/utils/cloudinary';


export async function POST(request: NextRequest) {
    console.log("🔹 Webhook received: Incoming request"); 

    try {
        
        await dbConnect(); 
        const body = await request.json();
        console.log("🔹 Webhook received data:", body); 

        const { request_id, status, payload} = body;

        if (!request_id || !status) {
            console.error("Webhook missing request_id or status:", body);
            return NextResponse.json({ error: "Invalid webhook data" }, { status: 400 });
        }

        console.log("🔹 Webhook received data:", { request_id, status, payload });

        const promptData= await Prompt.findOne({requestId: request_id })

        if(!promptData){
            return NextResponse.json({ error: "Request ID not found" }, { status: 200 });
        }

        if(promptData.status !== "processing"){
            return NextResponse.json({ error: "Request already Processed" }, { status: 200 });
        }
 
        console.log(`🔹 Webhook received for request_id: ${request_id}, Status: ${status}`);

        if (status !== "OK"){
            promptData.status = "failed";
            await promptData.save();

            return NextResponse.json({ message: "Processing..." }, { status: 202 });
        }

        const generatedVideo = payload?.video?.url; 

        if(!generatedVideo){
            promptData.status = "failed";
            await promptData.save();

            return NextResponse.json({ error: "No video URL found in payload" }, { status: 200 });
        }

        const cloudinaryUpload = await uploadVideoToCloudinary(generatedVideo);
        
        promptData.generatedUrl = cloudinaryUpload.secure_url;
        promptData.status = "completed";
        await promptData.save();

        return NextResponse.json({ message: "Video saved", generatedVideo }, { status: 200 });

    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}