export interface Slide {
  sid: string;
  text: string;
  created_at: string;
}

export interface SlideListResponse {
  slides: Slide[];
  title: string;
}

export interface ImageInfo {
  hash: string;
  url: string;
  cached: boolean;
}

export interface GenerateRequest {
  provider: 'gemini' | 'minimax';
  force?: boolean;
}

export interface GenerateResponse {
  sid: string;
  hash: string;
  image_url: string;
  cached: boolean;
}

export interface CostInfo {
  gemini_calls: number;
  minimax_calls: number;
  gemini_cost: number;
  minimax_cost: number;
  total_cost: number;
}

export interface PlaybackSlide {
  sid: string;
  text: string;
  main_image_url: string | null;
}

export interface PlaybackResponse {
  slides: PlaybackSlide[];
  start_index: number;
}
