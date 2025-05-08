import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

// Define a more complete type for the Fal.AI response
type FalResponse = {
    status: string;
    logs?: {
        progress?: number;
    };
    result?: any;
    error?: any;
};

export async function POST(request: NextRequest) {
    console.log("🔹 Starting video generation status check process");
    try {
        // Check API key configuration
        const apiKey = process.env.NEXT_PUBLIC_FAL_API_KEY || process.env.FAL_API_KEY;
        if (!apiKey) {
            console.error("❌ Missing FAL API key for status check");
            return NextResponse.json(
                { error: "Server configuration error: Missing API key" },
                { status: 500 }
            );
        }

        // Get the base URL for webhooks, similar to the submit route
        let baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
        console.log(`🔹 Initial base URL from environment: ${baseUrl || "Not configured"}`);
        
        // Make sure baseUrl has a protocol
        if (baseUrl && !baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
            console.log(`🔹 Added HTTPS protocol to base URL: ${baseUrl}`);
        }

        // Fallback: Use the request headers to construct the base URL if needed
        if (!baseUrl) {
            console.log("🔹 No base URL from environment, attempting to derive from request headers");
            const protocol = request.headers.get('x-forwarded-proto') || 'https';
            const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
            
            console.log(`🔹 Request header details:`, {
                protocol,
                host: host || "Not available",
                forwardedHost: request.headers.get('x-forwarded-host') || "Not available"
            });
            
            if (host) {
                baseUrl = `${protocol}://${host}`;
                console.log(`🔹 Derived base URL from headers: ${baseUrl}`);
            } else {
                console.warn("⚠️ Could not determine base URL from headers");
            }
        }

        console.log(`🔹 Final API base URL: ${baseUrl ? `${baseUrl}/api/fal/status` : "Could not determine"}`);
        
        console.log("🔹 Parsing request body...");
        const body = await request.json();
        const { requestId } = body;

        if (!requestId) {
            console.error("❌ Missing requestId in request body");
            return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
        }

        console.log(`🔹 Checking Fal.AI status for request: ${requestId}`);
        const startTime = Date.now();
        try {
            // Get the raw response and cast it to our more complete type
            const rawResponse = await fal.queue.status("fal-ai/hunyuan-video/video-to-video", { requestId, logs: true });
            const response = rawResponse as unknown as FalResponse;
            const responseTime = Date.now() - startTime;

            // Log response details with status information
            const status = response.status || "unknown";
            
            // Safely access nested properties
            const progress = response.logs?.progress || 0;
            const hasResult = !!response.result;
            const errorInfo = response.error || null;
            
            console.log(`✅ Fal.AI Status received in ${responseTime}ms:`, {
                requestId,
                status,
                progress: `${Math.round(progress * 100)}%`,
                hasResult,
                hasError: !!errorInfo
            });

            // More detailed logging of the full response for debugging
            console.log(`🔹 Full Fal.AI response for ${requestId}:`, JSON.stringify(response, null, 2));

            if (errorInfo) {
                console.error(`❌ Fal.AI reported error for request ${requestId}:`, errorInfo);
            }

            // Check different status types - using string comparison since we're using our own type
            if (status === "COMPLETED" || status === "completed") {
                console.log(`🎉 Request ${requestId} completed successfully`);
            } else if (status === "FAILED" || status === "failed") {
                console.error(`❌ Request ${requestId} failed`);
            } else if (status === "IN_PROGRESS" || status === "in_progress") {
                console.log(`⏳ Request ${requestId} in progress: ${Math.round(progress * 100)}% complete`);
            } else if (status === "IN_QUEUE" || status === "PENDING" || status === "pending") {
                console.log(`⏳ Request ${requestId} pending in queue`);
            } else {
                console.log(`🔹 Request ${requestId} has status: ${status}`);
            }

            return NextResponse.json({ response }, { status: 200 });
        } catch (statusError) {
            const responseTime = Date.now() - startTime;
            console.error(`❌ Error fetching status for request ${requestId} after ${responseTime}ms:`, statusError);
            
            // Provide more details about the error
            let errorMessage = "Unknown error";
            if (statusError instanceof Error) {
                errorMessage = statusError.message;
                console.error(`❌ Error details:`, {
                    name: statusError.name,
                    message: statusError.message,
                    stack: statusError.stack
                });
            }
            
            return NextResponse.json(
                { 
                    error: "Failed to check status", 
                    message: errorMessage,
                    requestId 
                }, 
                { status: 500 }
            );
        }
    } catch (error: unknown) {
        console.error("❌ Error in status check process:", error);
        
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
        
        return NextResponse.json(
            { 
                error: "Internal Server Error",
                message: errorMessage,
                ...errorDetails
            }, 
            { status: 500 }
        );
    }
}