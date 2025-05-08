import mongoose from "mongoose";

type ConnectionState = {
  isConnected?: mongoose.ConnectionStates;
};

const connectionState: ConnectionState = {};

/**
 * Connects to MongoDB database
 * @returns Promise that resolves when connection is established
 */
async function dbConnect(): Promise<void> {
  // Return early if already connected
  if (connectionState.isConnected === mongoose.ConnectionStates.connected) {
    console.log("[Database] Already connected to MongoDB");
    return;
  }

  // If mongoose has a connection but not fully connected, log the state
  if (mongoose.connections.length > 0) {
    const currentState = mongoose.connections[0].readyState;
    if (currentState === mongoose.ConnectionStates.connecting) {
      console.log("[Database] Connection in progress...");
      return;
    }
  }

  // Ensure environment variables are set
  if (!process.env.MONGODB_URI) {
    console.error("[Database] MONGODB_URI environment variable is not defined");
    process.exit(1);
  }


  const dbUrl = `${process.env.MONGODB_URI}`;
  
  try {
    console.log("[Database] Connecting to MongoDB...");
    const db = await mongoose.connect(dbUrl, {
      connectTimeoutMS: 10000, // 10 seconds
    });
    
    connectionState.isConnected = db.connections[0].readyState;
    
    console.log(`[Database] Connected successfully`);
  } catch (error: unknown) {
    console.error("[Database] Connection failed:");
    
    if (error instanceof Error) {
      console.error(`[Database] ${error.name}: ${error.message}`);
      if (error.stack) {
        console.error(`[Database] Stack trace: ${error.stack}`);
      }
    } else {
      console.error(`[Database] Unknown error: ${String(error)}`);
    }
    
    process.exit(1);
  }
}

export default dbConnect;