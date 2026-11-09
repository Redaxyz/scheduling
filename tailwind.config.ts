import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  // The dock in the iPhone Duo's status bar strip (see lib/sideDock.ts).
  plugins: [plugin(({ addVariant }) => addVariant("side-dock", 'html[data-dock="side"] &'))],
};

export default config;
