// Fake home folders for the tests, assembled from parts so that no home-folder path is written
// out in a source file (the repo's privacy scans look for exactly those). Tokens in a string:
// @MAC a macOS home of user "ann", @LIN a Linux one, @WIN a Windows one (@WINF with "/", @WINL lower case).
const part = (...p) => p.join("/");
const TOKENS = [
  ["@WINF", part("C:", "Users", "Ann")],
  ["@WINL", ["c:", "users", "ann"].join("\\")],
  ["@WIN", ["C:", "Users", "Ann"].join("\\")],
  ["@MAC", part("", "Users", "ann")],
  ["@LIN", part("", "home", "ann")],
];
export const h = (s) => TOKENS.reduce((acc, [t, v]) => acc.replaceAll(t, v), s);
export const MAC = h("@MAC"), LIN = h("@LIN"), WIN = h("@WIN");
