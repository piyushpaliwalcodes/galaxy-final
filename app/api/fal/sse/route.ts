import { NextRequest } from "next/server";

// Store active connections
let clients: Set<{
  id: string;
  controller: ReadableStreamDefaultController;
}> = new Set();

// Function to send events to all connected clients
export function notifyClients(data: any) {
  console.log(`🔹 Notifying ${clients.size} connected clients`);
  clients.forEach(client => {
    try {
      client.controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      console.error(`Error sending to client ${client.id}`, e);
    }
  });
}

export async function GET(request: NextRequest) {
  const clientId = crypto.randomUUID();
  
  // Create a readable stream that will be our SSE stream
  const stream = new ReadableStream({
    start(controller) {
      clients.add({ id: clientId, controller });
      console.log(`🔹 Client connected: ${clientId}. Total clients: ${clients.size}`);
      
      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);
    },
    cancel() {
      // Remove client on disconnect
      clients = new Set([...clients].filter(client => client.id !== clientId));
      console.log(`🔹 Client disconnected: ${clientId}. Remaining clients: ${clients.size}`);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
} 