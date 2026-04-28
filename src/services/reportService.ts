import { getSupabaseClient } from './supabase';

export type ReportTargetType = 'listing' | 'user' | 'comment';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'rejected';

export type ReportRecord = {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
};

export type ReportReasonStat = {
  reason: string;
  totalCount: number;
  pendingCount: number;
  reviewedCount: number;
  resolvedCount: number;
  rejectedCount: number;
};

export type ReportAction = {
  id: string;
  reportId: string;
  actorId: string;
  actionType: 'submitted' | 'reviewed' | 'resolved' | 'rejected';
  previousStatus: ReportStatus | null;
  nextStatus: ReportStatus;
  note: string | null;
  createdAt: string;
};

export type ReportTargetContext = {
  targetType: ReportTargetType;
  targetId: string;
  listingId: string | null;
  userId: string | null;
  commentId: string | null;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  description?: string | null;
  status: ReportStatus;
  created_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
};

type ReportReasonStatRow = {
  reason: string;
  total_count: number;
  pending_count: number;
  reviewed_count: number;
  resolved_count: number;
  rejected_count: number;
};

type ReportActionRow = {
  id: string;
  report_id: string;
  actor_id: string;
  action_type: 'submitted' | 'reviewed' | 'resolved' | 'rejected';
  previous_status: ReportStatus | null;
  next_status: ReportStatus;
  note?: string | null;
  created_at: string;
};

function mapReportRow(row: ReportRow): ReportRecord {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    description: row.description ?? null,
    status: row.status,
    createdAt: row.created_at,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewNote: row.review_note ?? null,
  };
}

function mapReportReasonStatRow(row: ReportReasonStatRow): ReportReasonStat {
  return {
    reason: row.reason,
    totalCount: Number(row.total_count ?? 0),
    pendingCount: Number(row.pending_count ?? 0),
    reviewedCount: Number(row.reviewed_count ?? 0),
    resolvedCount: Number(row.resolved_count ?? 0),
    rejectedCount: Number(row.rejected_count ?? 0),
  };
}

function mapReportActionRow(row: ReportActionRow): ReportAction {
  return {
    id: row.id,
    reportId: row.report_id,
    actorId: row.actor_id,
    actionType: row.action_type,
    previousStatus: row.previous_status ?? null,
    nextStatus: row.next_status,
    note: row.note ?? null,
    createdAt: row.created_at,
  };
}

export async function submitReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description?: string | null;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('submit_report', {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_description: input.description ?? null,
  });

  if (error) {
    throw error;
  }

  const reportId = String(data ?? '');
  if (!reportId) {
    throw new Error('Şikayet kaydı oluşturulamadı.');
  }

  return reportId;
}

export async function fetchMyReports(limit = 100): Promise<ReportRecord[]> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('reports')
    .select('id, reporter_id, target_type, target_id, reason, description, status, created_at, reviewed_by, reviewed_at, review_note')
    .eq('reporter_id', user.id)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));

  if (error) {
    throw error;
  }

  return ((data as ReportRow[] | null) ?? []).map(mapReportRow);
}

export async function fetchPendingReportsAdmin(limit = 100): Promise<ReportRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('fetch_pending_reports_admin', {
    p_limit: Math.max(1, Math.min(limit, 500)),
  });

  if (error) {
    throw error;
  }

  return ((data as ReportRow[] | null) ?? []).map(mapReportRow);
}

export async function fetchReportsAdmin(input?: {
  status?: ReportStatus;
  limit?: number;
}): Promise<ReportRecord[]> {
  const supabase = getSupabaseClient();
  const limit = Math.max(1, Math.min(input?.limit ?? 100, 500));

  let query = supabase
    .from('reports')
    .select('id, reporter_id, target_type, target_id, reason, description, status, created_at, reviewed_by, reviewed_at, review_note')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (input?.status) {
    query = query.eq('status', input.status);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return ((data as ReportRow[] | null) ?? []).map(mapReportRow);
}

export async function fetchReportReasonStatsAdmin(days = 30, limit = 20): Promise<ReportReasonStat[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('fetch_report_reason_stats_admin', {
    p_days: Math.max(1, Math.min(days, 365)),
    p_limit: Math.max(1, Math.min(limit, 100)),
  });

  if (error) {
    throw error;
  }

  return ((data as ReportReasonStatRow[] | null) ?? []).map(mapReportReasonStatRow);
}

export async function fetchReportActionsAdmin(reportId: string, limit = 50): Promise<ReportAction[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('fetch_report_actions_admin', {
    p_report_id: reportId,
    p_limit: Math.max(1, Math.min(limit, 200)),
  });

  if (error) {
    throw error;
  }

  return ((data as ReportActionRow[] | null) ?? []).map(mapReportActionRow);
}

export async function resolveReportTargetContextAdmin(report: Pick<ReportRecord, 'targetType' | 'targetId'>): Promise<ReportTargetContext> {
  const targetType = report.targetType;
  const targetId = report.targetId;

  if (targetType === 'listing') {
    return {
      targetType,
      targetId,
      listingId: targetId,
      userId: null,
      commentId: null,
    };
  }

  if (targetType === 'user') {
    return {
      targetType,
      targetId,
      listingId: null,
      userId: targetId,
      commentId: null,
    };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('listing_comments')
    .select('listing_id')
    .eq('id', targetId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    targetType,
    targetId,
    listingId: (data?.listing_id as string | undefined) ?? null,
    userId: null,
    commentId: targetId,
  };
}

export async function reviewReportAdmin(
  reportId: string,
  status: Exclude<ReportStatus, 'pending'>,
  reviewNote?: string | null,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('review_report_admin', {
    p_report_id: reportId,
    p_status: status,
    p_review_note: reviewNote ?? null,
  });

  if (error) {
    throw error;
  }
}
