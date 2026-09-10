import { createBrowserRouter } from "react-router";
import { createElement, type ComponentType } from "react";
import Root from "./components/layout/Root";

function RouteFallback() {
  return createElement("div", { className: "min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground" }, "Загрузка...");
}

const RELOAD_FLAG = "chunk-reload";

/**
 * Загружает страницу по требованию. Если вкладка была открыта до пересборки,
 * имена файлов уже другие и импорт падает — тогда перезагружаем страницу, чтобы
 * подтянуть свежую разметку. Флаг в sessionStorage не даёт зациклиться, если
 * файл недоступен по другой причине.
 */
const lazyPage = (loader: () => Promise<{ default: ComponentType }>) => async () => {
  try {
    const module = await loader();
    sessionStorage.removeItem(RELOAD_FLAG);
    return { Component: module.default };
  } catch (reason) {
    if (typeof window !== "undefined" && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
      // Возвращаем пустышку: страница всё равно вот-вот перезагрузится.
      return { Component: RouteFallback };
    }
    throw reason;
  }
};

const homePage = lazyPage(() => import("./pages/HomePage"));
const newsListPage = lazyPage(() => import("./pages/NewsListPage"));
const articlePage = lazyPage(() => import("./pages/ArticlePage"));
const departmentPage = lazyPage(() => import("./pages/DepartmentPage"));
const publicationArchivePage = lazyPage(() => import("./pages/PublicationArchivePage"));
const documentListPage = lazyPage(() => import("./pages/DocumentListPage"));
const vacancyListPage = lazyPage(() => import("./pages/VacancyListPage"));
const contactsPage = lazyPage(() => import("./pages/ContactsPage"));
const sectionLandingPage = lazyPage(() => import("./pages/SectionLandingPage"));
const instituteHistoryPage = lazyPage(() => import("./pages/InstituteHistoryPage"));
const educationPage = lazyPage(() => import("./pages/EducationPage"));
const scienceResearchPage = lazyPage(() => import("./pages/ScienceResearchPage"));
const scienceCertificatesPage = lazyPage(() => import("./pages/ScienceCertificatesPage"));
const notFoundPage = lazyPage(() => import("./pages/NotFoundPage"));
const adminPage = lazyPage(() => import("./pages/AdminPage"));
const searchPage = lazyPage(() => import("./pages/SearchPage"));
const siteMapPage = lazyPage(() => import("./pages/SiteMapPage"));


export const router = createBrowserRouter([
  { path: "/admin", lazy: adminPage, HydrateFallback: RouteFallback },
  {
    path: "/",
    Component: Root,
    HydrateFallback: RouteFallback,
    children: [
      { index: true, lazy: homePage },
      { path: "search", lazy: searchPage },
      { path: "site-map", lazy: siteMapPage },

      // News
      { path: "news", lazy: newsListPage },
      { path: "news/:id", lazy: articlePage },

      // Institute
      { path: "institute", lazy: sectionLandingPage },
      { path: "institute/history", lazy: instituteHistoryPage },
      { path: "institute/departments", lazy: departmentPage },
      { path: "institute/departments/:id", lazy: departmentPage },

      // Science
      { path: "science", lazy: sectionLandingPage },
      { path: "science/research", lazy: scienceResearchPage },
      { path: "science/research/:id", lazy: scienceResearchPage },
      { path: "science/projects", lazy: sectionLandingPage },
      { path: "science/events", lazy: sectionLandingPage },
      { path: "science/dmks", lazy: sectionLandingPage },
      { path: "science/rid", lazy: scienceCertificatesPage },

      // Education
      { path: "education", lazy: educationPage },
      { path: "education/license", lazy: educationPage },
      { path: "education/admission", lazy: educationPage },
      { path: "education/quota", lazy: educationPage },
      { path: "education/attestation", lazy: educationPage },
      { path: "education/exams", lazy: educationPage },
      { path: "education/fees", lazy: educationPage },
      { path: "education/enrolled", lazy: educationPage },
      { path: "education/library", lazy: educationPage },

      // Publications
      { path: "publications", lazy: publicationArchivePage },
      { path: "publications/archive", lazy: publicationArchivePage },
      { path: "publications/journal", lazy: publicationArchivePage },
      { path: "publications/collections", lazy: publicationArchivePage },

      // Documents
      { path: "documents", lazy: documentListPage },
      { path: "documents/charter", lazy: documentListPage },
      { path: "documents/normative", lazy: documentListPage },
      { path: "documents/reports", lazy: documentListPage },
      { path: "documents/anticorruption", lazy: documentListPage },
      { path: "documents/privacy", lazy: documentListPage },

      // Vacancies
      { path: "vacancies", lazy: vacancyListPage },

      // Contacts
      { path: "contacts", lazy: contactsPage },

      // Catch-all
      { path: "*", lazy: notFoundPage },
    ],
  },
]);
