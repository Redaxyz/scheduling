import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { SIDE_DOCK_MEDIA } from "./lib/sideDock";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  // A plugin variant, not a raw `screens` entry: any non-min-width screen
  // switches off every max-* variant (max-lg: and the like) across the app.
  plugins: [plugin(({ addVariant }) => addVariant("side-dock", `@media ${SIDE_DOCK_MEDIA}`))],
};

export default config;
