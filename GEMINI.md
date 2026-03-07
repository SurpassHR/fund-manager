# Project Standards (GEMINI.md)

This document outlines the global development standards and conventions for the Fund Manager project. All AI agents and developers should align with these guidelines.

## 1. Technology Stack
- **Framework:** React 19
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (v4)
- **Database:** Dexie.js (IndexedDB wrapper)
- **UI/Animations:** Framer Motion, Lucide React
- **Charts:** ECharts

## 2. Coding Conventions
- **TypeScript:** Use strict typing. Prefer `interface` over `type` for object definitions unless unions/intersections are needed.
- **React Components:**
  - Use Functional Components with Hooks.
  - Keep components modular and focused on a single responsibility.
  - Group related files (e.g., component, tests, styles if not using Tailwind) together if the codebase grows large, though currently a flat `components/` structure is used.
- **Styling:**
  - Use Tailwind CSS utility classes directly in the `className` attribute.
  - Avoid custom CSS unless absolutely necessary (e.g., complex animations not supported by Tailwind out-of-the-box).
  - Use responsive design patterns provided by Tailwind (e.g., `sm:`, `md:`).

## 3. Architecture & State Management
- **State:** Use React's built-in state (`useState`, `useReducer`, `useContext`) for UI state.
- **Database Interactivity:** Use `dexie-react-hooks` (`useLiveQuery`) for reactive database queries.
- **Services:** Isolate business logic and formatting tools in the `services/` directory (e.g., `api.ts`, `financeUtils.ts`).
- **I18n:** Use the existing custom i18n implementation (`services/i18n.tsx`).

## 4. File Structure
- `App.tsx` / `index.tsx`: Entry points.
- `components/`: UI components and page/modal views.
- `services/`: Core logic, database setup (`db.ts`), API clients, and utilities.
- `types.ts`: Global TypeScript interfaces and types.

## 5. Performance & Optimization
- Ensure database queries via Dexie are indexed to prevent performance bottlenecks.
- Use Vite's native optimizations; avoid unnecessary heavy dependencies.
- Use `React.memo`, `useMemo`, and `useCallback` judiciously when rendering lists or complex data (like ECharts).

## 6. Git Protocol
- Write clear, concise, and descriptive commit messages.
- Do not check in `.env` files, build artifacts (e.g., `dist/`), or local caches. Ensure they are in `.gitignore`.

_Note: These standards are intended to guide the development process and maintain consistency across the codebase. Adjustments can be made as the project scales._
