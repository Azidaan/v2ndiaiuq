export class PgAdminUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async list() {
    const result = await this.pool.query(
      `SELECT id, email, role, is_active, must_change_password, created_at, updated_at
       FROM admin_users ORDER BY created_at ASC`,
    );
    return result.rows;
  }

  async findById(id) {
    const result = await this.pool.query(
      `SELECT id, email, role, is_active, must_change_password, created_at, updated_at
       FROM admin_users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async create({ email, passwordHash, role }) {
    const result = await this.pool.query(
      `INSERT INTO admin_users (email, password_hash, role, must_change_password)
       VALUES ($1, $2, $3, true)
       RETURNING id, email, role, is_active, must_change_password, created_at, updated_at`,
      [email, passwordHash, role],
    );
    return result.rows[0];
  }

  async update(id, { role, isActive }) {
    const result = await this.pool.query(
      `UPDATE admin_users
       SET role = $1, is_active = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, email, role, is_active, must_change_password, created_at, updated_at`,
      [role, isActive, id],
    );
    return result.rows[0] ?? null;
  }

  async findCredentials(id) {
    const result = await this.pool.query(
      "SELECT id, password_hash FROM admin_users WHERE id = $1 AND is_active = true",
      [id],
    );
    return result.rows[0] ?? null;
  }

  async updatePassword(id, passwordHash, mustChangePassword) {
    const result = await this.pool.query(
      `UPDATE admin_users
       SET password_hash = $1, must_change_password = $2, updated_at = now()
       WHERE id = $3 RETURNING id`,
      [passwordHash, mustChangePassword, id],
    );
    return result.rowCount > 0;
  }

  async countActiveSuperadmins() {
    const result = await this.pool.query(
      "SELECT count(*)::int AS count FROM admin_users WHERE role = 'superadmin' AND is_active = true",
    );
    return result.rows[0].count;
  }

  async deleteSessions(id) {
    await this.pool.query("DELETE FROM admin_sessions WHERE admin_id = $1", [id]);
  }

  async deleteOtherSessions(id, currentTokenHash) {
    await this.pool.query(
      "DELETE FROM admin_sessions WHERE admin_id = $1 AND token_hash <> $2",
      [id, currentTokenHash],
    );
  }

  async remove(id) {
    const result = await this.pool.query("DELETE FROM admin_users WHERE id = $1 RETURNING id", [id]);
    return result.rowCount > 0;
  }
}
