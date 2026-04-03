export interface TimelineEvent {
  time: number;
  event: string;
  feedback: string;
}

export interface AnalysisResult {
  timeline: TimelineEvent[];
  video_url: string;
  duration: number;
}

const API_BASE = "http://127.0.0.1:8000";

export function getVideoUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function analyzeVideo(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return response.json();
}
