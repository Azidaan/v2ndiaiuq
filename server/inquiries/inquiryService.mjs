const statuses = new Set(["new", "in_progress", "resolved"]);

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

export class InquiryService {
  constructor(repository) {
    this.repository = repository;
  }

  async create(input) {
    if (String(input.website ?? "").trim()) return { accepted: true };
    return this.repository.create({
      name: this.#requiredText(input.name, "Укажите имя и фамилию", 2, 200),
      email: this.#email(input.email),
      subject: String(input.subject ?? "").trim().slice(0, 500),
      message: this.#requiredText(input.message, "Введите текст обращения (не менее 10 символов)", 10, 10_000),
    });
  }

  list(status) {
    const normalized = status ? this.#status(status) : null;
    return this.repository.list(normalized);
  }

  async update(id, input) {
    await this.#existing(id);
    const updated = await this.repository.update(id, {
      status: this.#status(input.status),
      adminNote: String(input.admin_note ?? "").trim().slice(0, 10_000),
    });
    if (!updated) throw httpError("Обращение не найдено", 404);
    return updated;
  }

  async remove(id) {
    await this.#existing(id);
    if (!(await this.repository.remove(id))) throw httpError("Обращение не найдено", 404);
    return { ok: true };
  }

  async #existing(id) {
    const inquiry = await this.repository.findById(id);
    if (!inquiry) throw httpError("Обращение не найдено", 404);
    return inquiry;
  }

  #requiredText(value, message, minimum, maximum) {
    const text = String(value ?? "").trim();
    if (text.length < minimum || text.length > maximum) throw httpError(message, 400);
    return text;
  }

  #email(value) {
    const email = String(value ?? "").trim().toLowerCase();
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw httpError("Укажите корректную электронную почту", 400);
    }
    return email;
  }

  #status(value) {
    const status = String(value ?? "");
    if (!statuses.has(status)) throw httpError("Неизвестный статус обращения", 400);
    return status;
  }
}
