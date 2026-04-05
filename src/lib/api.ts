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

const DEFAULT_API_BASE = "https://api.courtiq.cfd";
const API_BASE = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE);

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function withApiBase(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export function getVideoUrl(path: string): string {
  return withApiBase(path);
}

export async function fetchVideoBlob(path: string): Promise<string> {
  // Wait 5 seconds for the backend to finish writing the file
  await delay(5000);

  const res = await fetch(withApiBase(path), {
    headers: { "ngrok-skip-browser-warning": "true" },
  });
  if (!res.ok) throw new Error("Failed to load video");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function analyzeVideo(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(withApiBase("/analyze"), {
    method: "POST",
    body: formData,
    headers: { "ngrok-skip-browser-warning": "true" },
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return response.json();
}
