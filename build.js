const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: {
      content: "./content/index.js",
    },
    bundle: true,
    outfile: "./dist/content.js",
    format: "iife",
    target: ["chrome110"],
    sourcemap: true,
  })
  .catch(() => process.exit(1));
