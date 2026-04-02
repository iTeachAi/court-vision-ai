import { useState } from "react";
import HeroSection from "@/components/HeroSection";
import UploadZone from "@/components/UploadZone";
import AnalysisDashboard from "@/components/AnalysisDashboard";
import type { AnalysisResult } from "@/components/UploadZone";

type AppView = "hero" | "upload" | "dashboard";

const Index = () => {
  const [view, setView] = useState<AppView>("hero");
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [videoUrl, setVideoUrl] = useState("");

  const handleAnalysisComplete = (data: AnalysisResult, url: string) => {
    setAnalysisData(data);
    setVideoUrl(url);
    setView("dashboard");
  };

  return (
    <main className="min-h-screen bg-background">
      {view === "hero" && <HeroSection onGetStarted={() => setView("upload")} />}
      {view === "upload" && <UploadZone onAnalysisComplete={handleAnalysisComplete} />}
      {view === "dashboard" && analysisData && (
        <AnalysisDashboard data={analysisData} videoUrl={videoUrl} />
      )}
    </main>
  );
};

export default Index;
