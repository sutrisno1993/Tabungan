-- Buat fungsi exec_sql untuk menjalankan raw SQL query dari backend via RPC
-- PENTING: Fungsi ini hanya boleh dipanggil dari server (service_role), bukan dari browser

CREATE OR REPLACE FUNCTION exec_sql(query_text TEXT, query_params JSONB DEFAULT '[]'::JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text)
  INTO result;
  RETURN COALESCE(result, '[]'::JSONB);
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'exec_sql error: %', SQLERRM;
END;
$$;

-- Cabut akses public, hanya service_role yang boleh panggil
REVOKE ALL ON FUNCTION exec_sql(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION exec_sql(TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION exec_sql(TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT, JSONB) TO service_role;
