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

const API_BASE = "https://api.courtiq.cfd";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getVideoUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function fetchVideoBlob(path: string): Promise<string> {
  // Wait 5 seconds for the backend to finish writing the file
  await delay(5000);

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "ngrok-skip-browser-warning": "true" },
  });
  if (!res.ok) throw new Error("Failed to load video");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function analyzeVideo(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: formData,
    headers: { "ngrok-skip-browser-warning": "true" },
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return response.json();
}
