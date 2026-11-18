// Per-coach look for the 3D mentor stage.
//
// Keys are matched against Mentor#name (case-insensitive substring), so
// 'Arnold “The Oak”' matches "arnold". A mentor with no match gets DEFAULT_STYLE,
// so adding a new coach to the database never breaks the page.
//
// color  – main aura / rim-light color
// accent – secondary glow (particles, slash trails, ...)
// avatar – key into AVATAR_BUILDERS in mentor_stage/avatars.js
// model  – optional path to a rigged .glb (e.g. "/models/yoda.glb"); see loadAvatar()
//
// Quotes and neural voices live in Rails (app/models/mentor_voice.rb) and reach
// the page through data-mentor-stage-quotes-value. DEFAULT_STYLE.quotes is only
// used if a page renders the stage without them.

export const MENTOR_STYLES = {
  goggins: { avatar: "goggins", color: "#ff2d1f", accent: "#ff8a00" },
  sonic: { avatar: "sonic", color: "#1e7bff", accent: "#ffd23f" },
  mikasa: { avatar: "mikasa", color: "#9aa6b5", accent: "#e01e37" },
  arnold: { avatar: "arnold", color: "#e0a526", accent: "#c07a3c" },
  yoda: { avatar: "yoda", color: "#2bff88", accent: "#9dff6b" },
  jonah: { avatar: "jonah", color: "#b44cff", accent: "#22e5ff" }
}

export const DEFAULT_STYLE = {
  avatar: "default",
  color: "#c77dff",
  accent: "#f0b0ff",
  quotes: [
    "Let's get to work.",
    "One more rep.",
    "Consistency beats intensity."
  ]
}

export function styleFor(mentorName = "") {
  const name = mentorName.toLowerCase()
  const key = Object.keys(MENTOR_STYLES).find((k) => name.includes(k))
  return key ? MENTOR_STYLES[key] : DEFAULT_STYLE
}
