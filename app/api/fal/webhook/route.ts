import { NextRequest, NextResponse } from "next/server";
import Prompt from "@/app/models/video.models";
import dbConnect from "@/lib/db";
import { uploadVideoToCloudinary } from '@/utils/cloudinary';
import mongoose from "mongoose";

export async function POST(request: NextRequest) {
    console.log("🔹 Webhook received: Processing incoming FAL.AI notification"); 
    const startTime = Date.now();

    try {
        console.log("🔹 Connecting to database...");
        try {
            await dbConnect();
            console.log("🔹 Database connection successful for webhook processing");
        } catch (dbError) {
            console.error("❌ Database connection failed in webhook handler:", dbError);
            return NextResponse.json(
                { error: "Database connection failed", message: dbError instanceof Error ? dbError.message : String(dbError) },
                { status: 500 }
            );
        }
        
        // Log the request headers which can be useful for debugging
        const headers = Object.fromEntries(request.headers.entries());
        console.log("🔹 Webhook request headers:", JSON.stringify(headers, null, 2));
        
        let body;
        try {
            body = await request.json();
            console.log("🔹 Webhook payload received", { 
                request_id: body.request_id || "N/A", 
                status: body.status || "N/A",
                has_payload: !!body.payload
            });
        } catch (parseError) {
            console.error("❌ Error parsing webhook JSON data:", parseError);
            if (parseError instanceof Error) {
                console.error("❌ Parse error details:", { 
                    message: parseError.message,
                    stack: parseError.stack
                });
            }
            return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
        }

        const { request_id, status, payload} = body;

        if (!request_id || !status) {
            console.error("❌ Webhook data validation failed:", { 
                has_request_id: !!request_id, 
                has_status: !!status,
                body: JSON.stringify(body)
            });
            return NextResponse.json({ error: "Invalid webhook data" }, { status: 400 });
        }

        console.log(`🔹 Webhook details: request_id=${request_id}, status=${status}, has_video=${!!payload?.video?.url}`);

        console.log(`🔹 Looking up prompt record for request_id: ${request_id}`);
        const promptData = await Prompt.findOne({requestId: request_id });

        if(!promptData){
            console.error(`❌ No prompt record found for request_id: ${request_id}`);
            return NextResponse.json({ error: "Request ID not found" }, { status: 200 });
        }

        console.log(`🔹 Found prompt record: ${promptData._id}, current status: ${promptData.status}`);

        if(promptData.status !== "processing"){
            console.log(`⚠️ Webhook received for already processed request: ${request_id}, current status: ${promptData.status}`);
            return NextResponse.json({ error: "Request already Processed" }, { status: 200 });
        }
 
        if (status !== "OK"){
            console.error(`❌ Webhook indicates failed generation: Status=${status}, request_id=${request_id}`);
            
            try {
                promptData.status = "failed";
                await promptData.save();
                console.log(`🔹 Updated prompt ${promptData._id} status to 'failed'`);
            } catch (saveError) {
                console.error(`❌ Error updating prompt status to 'failed':`, saveError);
            }

            return NextResponse.json({ message: "Processing error recorded" }, { status: 202 });
        }

        const generatedVideo = payload?.video?.url; 

        if(!generatedVideo){
            console.error(`❌ No video URL in webhook payload: ${JSON.stringify(payload || {})}`);
            
            try {
                promptData.status = "failed";
                promptData.errorMessage = "No video URL in webhook payload";
                await promptData.save();
                console.log(`🔹 Updated prompt ${promptData._id} status to 'failed' (missing video URL)`);
            } catch (saveError) {
                console.error(`❌ Error updating prompt status:`, saveError);
            }

            return NextResponse.json({ error: "No video URL found in payload" }, { status: 200 });
        }

        console.log(`🔹 Uploading generated video to Cloudinary, video URL length: ${generatedVideo.length} chars`);
        try {
            const uploadStartTime = Date.now();
            const cloudinaryUpload = await uploadVideoToCloudinary(generatedVideo);
            const uploadTime = Date.now() - uploadStartTime;
            
            if (!cloudinaryUpload || !cloudinaryUpload.secure_url) {
                throw new Error("Failed to upload to Cloudinary (no secure_url in response)");
            }

            console.log(`🔹 Cloudinary upload successful in ${uploadTime}ms:`, {
                secure_url: cloudinaryUpload.secure_url,
                public_id: cloudinaryUpload.public_id,
                format: cloudinaryUpload.format,
                resource_type: cloudinaryUpload.resource_type
            });

            try {
                promptData.generatedUrl = cloudinaryUpload.secure_url;
                promptData.status = "completed";
                promptData.cloudinaryId = cloudinaryUpload.public_id;
                await promptData.save();
                console.log(`🔹 Updated prompt record with generated video URL and status='completed'`);
            } catch (saveError) {
                console.error(`❌ Error updating prompt with video URL:`, saveError);
                return NextResponse.json({ error: "Failed to update database" }, { status: 500 });
            }
            
            const totalTime = Date.now() - startTime;
            console.log(`✅ Successfully processed webhook for ${request_id} in ${totalTime}ms`);
            return NextResponse.json({ 
                message: "Video saved",
                url: cloudinaryUpload.secure_url
            }, { status: 200 });
        } catch (uploadError) {
            console.error("❌ Error uploading to Cloudinary:", uploadError);
            
            let errorMessage = "Unknown upload error";
            if (uploadError instanceof Error) {
                errorMessage = uploadError.message;
                console.error("❌ Upload error details:", {
                    name: uploadError.name,
                    message: uploadError.message,
                    stack: uploadError.stack
                });
            }
            
            try {
                promptData.status = "failed";
                promptData.errorMessage = `Cloudinary upload failed: ${errorMessage}`;
                await promptData.save();
                console.log(`🔹 Updated prompt ${promptData._id} status to 'failed' (cloudinary error)`);
            } catch (saveError) {
                console.error(`❌ Error updating prompt status after upload failure:`, saveError);
            }
            
            return NextResponse.json({ 
                error: "Failed to upload to Cloudinary",
                message: errorMessage
            }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error("❌ Unhandled webhook processing error:", error);
        
        let errorMessage = "Unknown error";
        let errorDetails = {};
        
        if (error instanceof Error) {
            errorMessage = error.message;
            errorDetails = { 
                name: error.name,
                stack: error.stack 
            };
            console.error("❌ Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        } else {
            console.error("❌ Unknown error type:", typeof error);
            errorMessage = String(error);
        }

        // Check database connection state in error handler
        let dbStatus = "Unknown";
        try {
            if (mongoose.connections.length > 0) {
                const connectionState = mongoose.connections[0].readyState;
                console.error(`❌ Database connection state during webhook error: ${connectionState}`);
                dbStatus = 
                    connectionState === mongoose.ConnectionStates.connected ? "Connected" :
                    connectionState === mongoose.ConnectionStates.connecting ? "Connecting" :
                    connectionState === mongoose.ConnectionStates.disconnected ? "Disconnected" :
                    connectionState === mongoose.ConnectionStates.disconnecting ? "Disconnecting" : "Unknown";
            } else {
                console.error("❌ No database connections available during webhook error");
                dbStatus = "No connection";
            }
        } catch (dbError) {
            console.error("❌ Error checking database status:", dbError);
        }
        
        return NextResponse.json({ 
            error: "Internal Server Error",
            message: errorMessage,
            dbStatus,
            ...errorDetails
        }, { status: 500 });
    }
}