/**
 * Centralized SQL queries for SITAB.
 * All balance calculations are done dynamically — no stored balance columns.
 * All queries consistently filter out soft-deleted transactions (deleted_at IS NULL).
 */

// ── Balance ───────────────────────────────────────────────────────────────────
export const GET_BALANCE_BY_NIS = `
  SELECT
    s.nis,
    s.name,
    s.class_name,
    COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0) AS total_setor,
    COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0) AS total_potong,
    COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE -t.amount END), 0) AS balance
  FROM students s
  LEFT JOIN transactions t ON s.nis = t.nis AND t.deleted_at IS NULL
  WHERE s.nis = $1
  GROUP BY s.nis, s.name, s.class_name
`

export const GET_BALANCES_BY_CLASS = `
  SELECT
    s.nis,
    s.name,
    s.class_name,
    COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0) AS total_setor,
    COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0) AS total_potong,
    COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE -t.amount END), 0) AS balance
  FROM students s
  LEFT JOIN transactions t ON s.nis = t.nis AND t.deleted_at IS NULL
  WHERE s.class_name = $1
  GROUP BY s.nis, s.name, s.class_name
  ORDER BY s.name ASC
`

// ── Grid View (Month + Class) ─────────────────────────────────────────────────
export const GET_GRID_TRANSACTIONS = `
  SELECT
    t.id,
    t.nis,
    s.name,
    t.date,
    t.amount,
    t.type,
    t.description,
    t.agenda_id
  FROM transactions t
  JOIN students s ON t.nis = s.nis
  WHERE s.class_name = $1
    AND EXTRACT(YEAR FROM t.date) = $2
    AND EXTRACT(MONTH FROM t.date) = $3
    AND t.deleted_at IS NULL
  ORDER BY s.name ASC, t.date ASC
`

// ── Dashboard Summary ─────────────────────────────────────────────────────────
export const GET_CLASS_SUMMARY = `
  SELECT
    COUNT(DISTINCT s.nis) AS total_students,
    COALESCE(SUM(CASE WHEN t.type = 'SETOR' THEN t.amount ELSE 0 END), 0) AS total_collected,
    COALESCE(SUM(CASE WHEN t.type = 'POTONG' THEN t.amount ELSE 0 END), 0) AS total_debited
  FROM students s
  LEFT JOIN transactions t ON s.nis = t.nis AND t.deleted_at IS NULL
  WHERE s.class_name = $1
`

// ── Agenda Progress ───────────────────────────────────────────────────────────
export const GET_AGENDA_PROGRESS = `
  SELECT
    a.id,
    a.agenda_name,
    a.target_amount,
    a.due_date,
    COUNT(DISTINCT s.nis)::integer AS total_students,
    COUNT(DISTINCT CASE WHEN bal.balance >= a.target_amount THEN s.nis END)::integer AS students_met,
    COALESCE(SUM(CASE WHEN t.type = 'POTONG' AND t.agenda_id = a.id THEN t.amount ELSE 0 END), 0)::numeric AS total_debited
  FROM agendas a
  LEFT JOIN students s ON s.class_name = a.class_name
  LEFT JOIN transactions t ON t.nis = s.nis AND t.deleted_at IS NULL
  LEFT JOIN (
    SELECT nis,
      SUM(CASE WHEN type = 'SETOR' THEN amount ELSE -amount END) AS balance
    FROM transactions
    WHERE deleted_at IS NULL
    GROUP BY nis
  ) bal ON bal.nis = s.nis
  WHERE a.class_name = $1
  GROUP BY a.id, a.agenda_name, a.target_amount, a.due_date
  ORDER BY a.due_date ASC
`

// ── Transaction History (Student) ─────────────────────────────────────────────
export const GET_STUDENT_HISTORY = `
  SELECT
    t.id,
    t.date,
    t.amount,
    t.type,
    t.description,
    a.agenda_name
  FROM transactions t
  LEFT JOIN agendas a ON t.agenda_id = a.id
  WHERE t.nis = $1
    AND t.deleted_at IS NULL
  ORDER BY t.date DESC, t.id DESC
`
