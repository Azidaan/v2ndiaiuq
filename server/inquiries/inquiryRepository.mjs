export class PgInquiryRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ name, email, subject, message }) {
    const result = await this.pool.query(
      `INSERT INTO inquiries (name, email, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [name, email, subject, message],
    );
    return result.rows[0];
  }

  async list(status) {
    const result = status
      ? await this.pool.query(
          `SELECT * FROM inquiries WHERE status = $1
           ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, created_at DESC`,
          [status],
        )
      : await this.pool.query(
          `SELECT * FROM inquiries
           ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, created_at DESC`,
        );
    return result.rows;
  }

  async findById(id) {
    const result = await this.pool.query("SELECT * FROM inquiries WHERE id = $1", [id]);
    return result.rows[0] ?? null;
  }

  async update(id, { status, adminNote }) {
    const result = await this.pool.query(
      `UPDATE inquiries SET status = $1, admin_note = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [status, adminNote, id],
    );
    return result.rows[0] ?? null;
  }

  async remove(id) {
    const result = await this.pool.query("DELETE FROM inquiries WHERE id = $1 RETURNING id", [id]);
    return result.rowCount > 0;
  }
}
