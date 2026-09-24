export type WardSummary = {
  id: number;
  name: string;
  province_id?: number | null;
};

export type Suggestion = {
  id: number;
  content: string;
  component?: string | null;
  description?: string | null;
  issueDate?: string | null;
  fileUrl?: string | null;
  policyId?: number | null;
  wardId?: number | null;
  ward?: WardSummary | null;
  status: string;
  createdAt: string;
};
