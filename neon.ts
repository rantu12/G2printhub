import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  buckets: {
    "printhub-uploads": { access: "private" },
  },
});
