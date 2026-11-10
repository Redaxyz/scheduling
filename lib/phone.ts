// What counts as "a phone" for the phone-only chrome (the flush dock, the
// bottom date bar, the iPhone Duo side rail): anything narrow, plus anything
// short AND under the lg breakpoint — a phone on its side, or the iPhone
// Duo's outer screen on its side (594×368). Every regular iPhone fits under
// 500px one way or the other; a portrait iPad (744+ wide, 1000+ tall) and
// the Duo's big inner screen (see UNFOLDED_QUERY) don't.
//
// Shared by Tailwind's `phone:` variant (see tailwind.config.ts) and the
// few places that have to ask in JS, so the two can't drift apart. The
// phone-only block at the bottom of globals.css repeats it by hand.
export const PHONE_QUERY = "(max-width: 500px), (max-width: 1023px) and (max-height: 500px)";

// The iPhone Duo opened up to its big inner screen (about 670–700 wide in
// portrait, 950 wide in landscape, never more than ~900 tall). It gets the
// computer layout — offices side by side, controls in the page header —
// even though it's narrower than the lg breakpoint that normally means
// "computer". Touch-only, so a laptop's narrow browser window doesn't
// match; and capped in height, so a portrait iPad (1000+ tall) doesn't.
export const UNFOLDED_QUERY =
  "(pointer: coarse) and (min-width: 600px) and (max-width: 1023px) and (min-height: 501px) and (max-height: 960px)";

// Where the date control sits in one row beside the dock at the bottom of
// the screen, instead of in each page's header: anything bigger than a
// phone that ISN'T a touch-only tablet (computers and laptops — including
// touchscreen ones, whose "main" pointer can report as touch), plus the
// unfolded Duo. Deliberately phrased as "not touch-only" rather than "has
// a mouse": a desktop must never end up with no date controls at all.
const NOT_TOUCH_ONLY = "(not ((hover: none) and (pointer: coarse)))";
export const DOCK_ROW_QUERY = `(min-width: 1024px) and ${NOT_TOUCH_ONLY}, (min-width: 501px) and (min-height: 501px) and ${NOT_TOUCH_ONLY}, ${UNFOLDED_QUERY}`;
