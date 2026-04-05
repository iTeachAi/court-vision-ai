import { useState, useCallback } from "react";
import HeroSection from "@/components/HeroSection";
import UploadZone from "@/components/UploadZone";
import AnalysisDashboard from "@/components/AnalysisDashboard";
import { analyzeVideo, getVideoUrl, type AnalysisResult } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type AppView = "hero" | "upload" | "dashboard";

const Index = () => {
  const [view, setView] = useState<AppView>("hero");
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleFileSelected = useCallback(async (file: File) => {
    setLoading(true);

    try {
      const result = await analyzeVideo(file);

      if (!result.video_url || typeof result.video_url !== "string") {
        throw new Error("Server returned an invalid video URL.");
      }

      setAnalysisData(result);
      setVideoUrl(getVideoUrl(result.video_url));
      setView("dashboard");
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Could not reach the analysis server. Make sure the backend is running.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return (
    <main className="min-h-screen bg-background">
      {view === "hero" && <HeroSection onGetStarted={() => setView("upload")} />}
      {view === "upload" && (
        <UploadZone onFileSelected={handleFileSelected} loading={loading} />
      )}
      {view === "dashboard" && analysisData && (
        <AnalysisDashboard data={analysisData} videoUrl={videoUrl} />
      )}
    </main>
  );
};

export default Index;
