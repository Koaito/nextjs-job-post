import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Alias "@/..." khớp `paths` trong tsconfig.json. Test chạy trên môi trường
// node (không cần jsdom): mọi thứ đang test ở đây là logic thuần hoặc
// Server-side (lib/), chưa có test component.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Mỗi test tự dọn mock/stub của nó, tránh rò rỉ giữa các file.
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
