// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManagedContent } from "../lib/content";
import HomePage from "./HomePage";
import NewsListPage from "./NewsListPage";
import ArticlePage from "./ArticlePage";

const state = vi.hoisted(() => ({ items: [] as ManagedContent[], loading: true, error: null as Error | null }));
vi.mock("../lib/content", async (original) => ({ ...await original<typeof import("../lib/content")>(), useManagedContent: (type: string) => type === "news" ? state : { items: [], loading: false, error: null } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => { state.items = []; state.loading = true; state.error = null; });
describe.each([HomePage, NewsListPage, ArticlePage])("news data loading (%s)", (Page) => {
  it("shows only server news after loading, never demo images while loading, empty or failed", async () => {
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    const draw = () => act(async () => root.render(<MemoryRouter initialEntries={["/news/real-post"]}><Routes><Route path="/news/:id" element={<Page />} /></Routes></MemoryRouter>));
    try {
      await draw();
      expect(host.textContent).toContain("Загрузка");
      expect(host.innerHTML).not.toContain("unsplash.com");
      expect(host.innerHTML).not.toContain("aaai-2026");
      state.loading = false;
      state.items = [{ id: "real", type: "news", title: "Реальная новость из базы", slug: "real-post", summary: "", body: "Текст", category: "institute", published_at: "2026-10-26", status: "published", image_url: "/uploads/real.jpg", file_url: "", metadata: {} }];
      await draw();
      expect(host.textContent).toContain("Реальная новость из базы");
      expect(host.innerHTML).toContain("/uploads/real.jpg");
      state.items = [];
      await draw();
      expect(host.innerHTML).not.toContain("unsplash.com");
      expect(host.innerHTML).not.toContain("aaai-2026");
      state.error = new Error("offline");
      await draw();
      expect(host.textContent).toContain("Не удалось загрузить");
      expect(host.innerHTML).not.toContain("unsplash.com");
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
});
