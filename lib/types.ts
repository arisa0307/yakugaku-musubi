import type { Harshness } from "./harshness";

export type Role = "student" | "admin";
export type EventStatus = "draft" | "open" | "closed";
export type CommentKind = "good" | "improve";

export type Profile = {
  id: string;
  display_name: string;
  role: Role;
};

export type EventRow = {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: EventStatus;
  created_by: string | null;
  join_code?: string | null;
};

export type Participant = {
  id: string;
  event_id: string;
  user_id: string;
  group_no: number | null;
  requested_harshness: Harshness;
};

export type RubricItem = {
  id: string;
  event_id: string | null;
  sort_order: number;
  label: string;
  description: string | null;
  min_score: number;
  max_score: number;
  anchors: Record<string, string> | null;
};

export type CommentOption = {
  id: string;
  event_id: string | null;
  kind: CommentKind;
  text: string;
  sort_order: number;
  min_harshness: Harshness;
};

// get_my_feedback RPC の戻り（evaluator_id は含まれない）
export type FeedbackRubric = {
  rubric_item_id: string;
  label: string;
  description: string | null;
  sort_order: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
};

export type FeedbackCommentTally = {
  comment_option_id: string;
  text: string;
  count: number;
};

export type MyFeedback = {
  event_id: string;
  evaluation_count: number;
  rubric: FeedbackRubric[];
  comments: { good: FeedbackCommentTally[]; improve: FeedbackCommentTally[] };
  top_improvement: FeedbackCommentTally[];
  free_notes: string[];
};

export type HistoryItem = { label: string; avg: number | null; count: number };
export type HistoryEvent = {
  event_id: string;
  title: string;
  scheduled_at: string | null;
  items: HistoryItem[];
};
