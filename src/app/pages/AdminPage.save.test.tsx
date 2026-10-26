// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "./AdminPage";
import { authService } from "../lib/authService";
import { contentRepository } from "../lib/contentRepository";
import { EMPTY_CONTENT, type ManagedContent } from "../lib/content";

vi.mock("./AdminVisualEditor", () => ({ default: () => null }));
vi.mock("../components/admin/LegacyNewsSyncPanel", () => ({ default: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const item: ManagedContent = { ...EMPTY_CONTENT, id: "existing", title: "Существующая новость", slug: "existing-news", body: "Текст новости", published_at: "2026-10-26", status: "published" };
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === text)!;
async function submit() { await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); }

beforeEach(async () => {
  vi.spyOn(authService, "getSession").mockResolvedValue({ user: { id: "editor", email: "editor@example.test", role: "editor", must_change_password: false } });
  vi.spyOn(contentRepository, "list").mockResolvedValue([item]);
  vi.spyOn(contentRepository, "slugExists").mockResolvedValue(false);
  vi.spyOn(contentRepository, "save").mockImplementation(async (payload) => ({ ...payload, id: payload.id || "created-id" }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<MemoryRouter><AdminPage /></MemoryRouter>));
  await act(async () => button("Новости").click());
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("save without leaving the editor", () => {
  it("retains the same form, position and enabled save button after saving an existing post", async () => {
    await act(async () => host.querySelector<HTMLButtonElement>('button[title="Редактировать"]')!.click());
    const form = host.querySelector("form");
    vi.mocked(window.scrollTo).mockClear();
    await submit();
    expect(host.querySelector("form")).toBe(form);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Сохранено");
    expect(button("Сохранить").disabled).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
    await submit();
    expect(contentRepository.save).toHaveBeenCalledTimes(2);
    expect(vi.mocked(contentRepository.save).mock.calls[1][0].id).toBe("existing");
  });
  it("retains the newly assigned ID so a second save updates the post instead of creating a duplicate", async () => {
    await act(async () => button("Добавить").click());
    const title = host.querySelector<HTMLInputElement>("form input.admin-input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "Новая новость");
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await submit();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Сохранено");
    expect(vi.mocked(contentRepository.save).mock.calls[0][0].id).toBe("");
    await submit();
    expect(vi.mocked(contentRepository.save).mock.calls[1][0].id).toBe("created-id");
    expect(vi.mocked(contentRepository.save).mock.calls[1][0].slug).toBe("новая-новость");
    expect(host.querySelector("form")).not.toBeNull();
  });
  it("keeps the form and its values available after a failed save", async () => {
    await act(async () => host.querySelector<HTMLButtonElement>('button[title="Редактировать"]')!.click());
    vi.mocked(contentRepository.save).mockRejectedValueOnce(new Error("offline"));
    await submit();
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Не удалось сохранить");
    expect(host.querySelector<HTMLInputElement>("form input.admin-input")?.value).toBe(item.title);
    expect(button("Сохранить").disabled).toBe(false);
  });
  it("returns to the same news row and scroll position using the exit button after saving", async () => {
    let scroll = 1500;
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "scrollY", "get").mockImplementation(() => scroll);
    vi.mocked(window.scrollTo).mockImplementation((_x, y) => { scroll = y ?? scroll; });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, this.id === "content-item-existing" ? 1625 - scroll : 0, 640, 80);
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    await act(async () => host.querySelector<HTMLButtonElement>('button[title="Редактировать"]')!.click());
    expect(scroll).toBe(0);
    await submit();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Сохранено");
    await act(async () => button("Выйти к списку новостей").click());
    while (frames.length) await act(async () => frames.shift()!(0));
    expect(host.querySelector("form")).toBeNull();
    expect(host.querySelector("#content-item-existing")).not.toBeNull();
    expect(scroll).toBe(1500);
  });
});
