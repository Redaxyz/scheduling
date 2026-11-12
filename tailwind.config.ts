import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { DOCK_ROW_QUERY, PHONE_QUERY, UNFOLDED_QUERY } from "./lib/phone";

const config: Config = {
  // lib/ too: some class names live there (e.g. pill text in lib/homeColors.ts).
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // The app's one page color (see --page-bg in app/globals.css).
      colors: { page: "var(--page-bg)" },
    },
  },
  plugins: [
    // `phone:`, `unfolded:` and `dockrow:` (see lib/phone.ts) — variants rather than
    // `screens` entries, because adding a non-min-width screen would switch
    // off the max-lg:/max-sm: variants the rest of the app relies on.
    plugin(({ addVariant }) => {
      addVariant("phone", `@media ${PHONE_QUERY}`);
      addVariant("unfolded", `@media ${UNFOLDED_QUERY}`);
      addVariant("dockrow", `@media ${DOCK_ROW_QUERY}`);
      // The dock in the iPhone Duo's status bar strip (see lib/sideDock.ts).
      addVariant("side-dock", 'html[data-dock="side"] &');
    }),
  ],
};

export default config;
