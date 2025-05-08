import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export async function POST(request: NextRequest) {
    try {
        // Get the base URL for webhooks, similar to the submit route
        let baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
        
        // Make sure baseUrl has a protocol
        if (baseUrl && !baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
        }

        // Fallback: Use the request headers to construct the base URL if needed
        if (!baseUrl) {
            const protocol = request.headers.get('x-forwarded-proto') || 'https';
            const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
            if (host) {
                baseUrl = `${protocol}://${host}`;
            }
        }

        console.log(`🔹 Current API base URL: ${baseUrl}/api/fal/status`);
        
        const body = await request.json();
        const { requestId } = body;

        if (!requestId) {
            return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
        }

        console.log("🔹 Checking Fal.AI status for:", requestId);
        const response = await fal.queue.status("fal-ai/hunyuan-video/video-to-video", { requestId, logs: true });

        console.log("✅ Fal.AI Status:", response);

        return NextResponse.json({ response }, { status: 200 });

    } catch (error) {
        console.error("Error fetching status:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}