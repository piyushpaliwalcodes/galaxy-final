import { NextRequest, NextResponse } from "next/server";
import Prompt from "@/app/models/video.models";
import dbConnect from "@/lib/db";
import { uploadVideoToCloudinary } from '@/utils/cloudinary';


export async function POST(request: NextRequest) {
    console.log("🔹 Webhook received: Incoming request"); 

    try {
        await dbConnect(); 
        
        // Log the request headers which can be useful for debugging
        const headers = Object.fromEntries(request.headers.entries());
        console.log("🔹 Webhook request headers:", headers);
        
        let body;
        try {
            body = await request.json();
            console.log("🔹 Webhook received data:", body); 
        } catch (parseError) {
            console.error("❌ Error parsing webhook JSON data:", parseError);
            return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
        }

        const { request_id, status, payload} = body;

        if (!request_id || !status) {
            console.error("Webhook missing request_id or status:", body);
            return NextResponse.json({ error: "Invalid webhook data" }, { status: 400 });
        }

        console.log("🔹 Webhook received data:", { request_id, status, payload });

        const promptData = await Prompt.findOne({requestId: request_id });

        if(!promptData){
            console.error(`❌ Webhook for unknown request_id: ${request_id}`);
            return NextResponse.json({ error: "Request ID not found" }, { status: 200 });
        }

        if(promptData.status !== "processing"){
            console.log(`🔹 Webhook received for already processed request: ${request_id}, current status: ${promptData.status}`);
            return NextResponse.json({ error: "Request already Processed" }, { status: 200 });
        }
 
        console.log(`🔹 Webhook received for request_id: ${request_id}, Status: ${status}`);

        if (status !== "OK"){
            console.log(`🔹 Webhook received with non-OK status: ${status}`);
            promptData.status = "failed";
            await promptData.save();

            return NextResponse.json({ message: "Processing..." }, { status: 202 });
        }

        const generatedVideo = payload?.video?.url; 

        if(!generatedVideo){
            console.error("❌ No video URL found in payload:", payload);
            promptData.status = "failed";
            await promptData.save();

            return NextResponse.json({ error: "No video URL found in payload" }, { status: 200 });
        }

        console.log(`🔹 Uploading generated video to Cloudinary: ${generatedVideo}`);
        try {
            const cloudinaryUpload = await uploadVideoToCloudinary(generatedVideo);
            
            if (!cloudinaryUpload || !cloudinaryUpload.secure_url) {
                throw new Error("Failed to upload to Cloudinary");
            }

            promptData.generatedUrl = cloudinaryUpload.secure_url;
            promptData.status = "completed";
            await promptData.save();
            
            console.log(`✅ Successfully processed webhook: ${request_id}, video URL: ${cloudinaryUpload.secure_url}`);
            return NextResponse.json({ message: "Video saved", generatedVideo }, { status: 200 });
        } catch (uploadError) {
            console.error("❌ Error uploading to Cloudinary:", uploadError);
            promptData.status = "failed";
            await promptData.save();
            return NextResponse.json({ error: "Failed to upload to Cloudinary" }, { status: 500 });
        }

    } catch (error) {
        console.error("❌ Webhook processing error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}