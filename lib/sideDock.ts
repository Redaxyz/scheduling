// The iPhone Duo unfolded: a touchscreen at least 560 points across in both
// directions, but smaller than an iPad. Regular iPhones are narrower, turned
// sideways they're shorter, and iPads are bigger. There the dock moves from
// the bottom to the right edge (the `side-dock:` variant in
// tailwind.config.ts and the matching rules in app/globals.css, which repeats
// this query since plain CSS can't import it).
export const SIDE_DOCK_MEDIA =
  "(pointer: coarse) and (min-width: 560px) and (max-width: 1000px) and (min-height: 560px) and (max-height: 1000px)";
