// Global test setup — runs before each test file
// Mocks next/navigation and next/cache (Next.js server internals)
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
