export interface Voice {
  id: string;
  name: string;
}

export interface AudioEntry {
  id: number;
  text: string;
  audioUrl: string | null;
  isLoading: boolean;
  error: string | null;
}
