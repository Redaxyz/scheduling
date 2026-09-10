import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CFA Ortho Schedule",
    short_name: "Schedule",
    // Always land on the Home tab (which redirects to today) on launch,
    // regardless of whatever page was open when this was added to the home screen.
    start_url: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#94a3b8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
