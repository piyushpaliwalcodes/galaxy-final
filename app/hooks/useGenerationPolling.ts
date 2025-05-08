import { useState, useEffect, useRef } from "react";

function useGenerations(interval: number = 5000) {
  const [generations, setGenerations] = useState<{
    requestId: string;
    referenceVideoUrl: string;
    status: "processing" | "failed" | "completed";
    generatedUrl?: string;
  }[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchGenerations = async () => {
    try {
      const response = await fetch("/api/fal/generations");
      const data = await response.json();
      const generationData= data.prompts
      setGenerations(generationData);

      const hasProcessing = generationData.some((g:any) => g.status === "processing");

      console.log("Processing generations:" , hasProcessing)
      if (!hasProcessing && pollingRef.current) {
          console.log("No processing generations remaining. Stopping poll.");
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } catch (error) {
      console.error("Error fetching generations:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to manually refresh generations
  const refreshGenerations = async () => {
    setIsRefreshing(true);
    await fetchGenerations();
  };

  useEffect(() => { 
    if (!pollingRef.current) {
      pollingRef.current = setInterval(fetchGenerations, interval);
      fetchGenerations();
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [interval]);

  function generateNewRequest(requestId: string, referenceVideoUrl: string) {
    setGenerations(prev => [...prev, { requestId, referenceVideoUrl, status: "processing" }]);
    if (!pollingRef.current) {
      pollingRef.current = setInterval(() => fetchGenerations(), interval);
    }
  }

  return { generations, generateNewRequest, refreshGenerations, isRefreshing };
}

export default useGenerations;