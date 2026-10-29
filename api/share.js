// The function at /api/share. Its code is in _share.js, which Vercel doesn't
// turn into a function of its own (it starts with "_"), so tests can load it.
export { GET, POST } from "./_share.js";
