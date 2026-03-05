-- Enable Supabase Realtime for tables that need live streaming.
-- Without this, postgres_changes subscriptions in the frontend receive no events.

ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE approval_requests;
