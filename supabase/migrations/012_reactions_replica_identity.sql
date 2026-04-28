-- Fix realtime DELETE events for message_reactions
-- Without REPLICA IDENTITY FULL, payload.old only contains the PK (id),
-- which breaks client-side filtering by message_id / user_id.
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
