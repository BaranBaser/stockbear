import { defineConfig } from "vitest/config";

// Unit tests run handlers locally; the Start build plugin would rewrite them
// into HTTP RPC stubs before Vitest can apply transport mocks.
export default defineConfig({});
