import { Roles } from "../auth/rolePolicy.mjs";

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

export class AdminUserService {
  constructor({ repository, passwordHasher, rolePolicy }) {
    this.repository = repository;
    this.passwordHasher = passwordHasher;
    this.rolePolicy = rolePolicy;
  }

  list() {
    return this.repository.list();
  }

  async create(input) {
    const email = this.#email(input.email);
    const password = this.#password(input.password);
    const role = this.#role(input.role);
    try {
      return await this.repository.create({
        email,
        passwordHash: await this.passwordHasher.hash(password),
        role,
      });
    } catch (error) {
      if (error.code === "23505") throw httpError("Пользователь с такой почтой уже существует", 409);
      throw error;
    }
  }

  async update(id, input, actorId) {
    const current = await this.#existing(id);
    const role = this.#role(input.role);
    const isActive = input.is_active === true;
    if (id === actorId && !isActive) throw httpError("Нельзя заблокировать собственную учётную запись", 409);
    await this.#protectLastSuperadmin(current, role, isActive);
    const updated = await this.repository.update(id, { role, isActive });
    if (!updated) throw httpError("Пользователь не найден", 404);
    if (!isActive || current.role !== role) await this.repository.deleteSessions(id);
    return updated;
  }

  async resetPassword(id, password, actorId) {
    await this.#existing(id);
    const changed = await this.repository.updatePassword(
      id,
      await this.passwordHasher.hash(this.#password(password)),
      id !== actorId,
    );
    if (!changed) throw httpError("Пользователь не найден", 404);
    if (id !== actorId) await this.repository.deleteSessions(id);
    return { ok: true };
  }

  async changeOwnPassword(id, currentPassword, newPassword, currentTokenHash) {
    const credentials = await this.repository.findCredentials(id);
    if (!credentials || !(await this.passwordHasher.verify(String(currentPassword ?? ""), credentials.password_hash))) {
      throw httpError("Текущий пароль указан неверно", 401);
    }
    await this.repository.updatePassword(id, await this.passwordHasher.hash(this.#password(newPassword)), false);
    await this.repository.deleteOtherSessions(id, currentTokenHash);
    return { ok: true };
  }

  async remove(id, actorId) {
    if (id === actorId) throw httpError("Нельзя удалить собственную учётную запись", 409);
    const current = await this.#existing(id);
    await this.#protectLastSuperadmin(current, null, false);
    if (!(await this.repository.remove(id))) throw httpError("Пользователь не найден", 404);
    return { ok: true };
  }

  async #protectLastSuperadmin(current, nextRole, nextActive) {
    if (current.role !== Roles.SUPERADMIN || !current.is_active) return;
    if (nextRole === Roles.SUPERADMIN && nextActive) return;
    if (await this.repository.countActiveSuperadmins() <= 1) {
      throw httpError("В системе должен остаться хотя бы один активный главный администратор", 409);
    }
  }

  async #existing(id) {
    const user = await this.repository.findById(id);
    if (!user) throw httpError("Пользователь не найден", 404);
    return user;
  }

  #email(value) {
    const email = String(value ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      throw httpError("Укажите корректную электронную почту", 400);
    }
    return email;
  }

  #password(value) {
    const password = String(value ?? "");
    if (password.length < 12 || password.length > 200) {
      throw httpError("Пароль должен содержать от 12 до 200 символов", 400);
    }
    return password;
  }

  #role(value) {
    const role = String(value ?? "");
    if (!this.rolePolicy.isRole(role)) throw httpError("Неизвестная роль пользователя", 400);
    return role;
  }
}
