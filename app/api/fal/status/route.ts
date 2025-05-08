import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export async function POST(request: NextRequest) {
    try {
        console.log(`${process.env.NEXT_PUBLIC_VERCEL_URL }/api/fal/status`);
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