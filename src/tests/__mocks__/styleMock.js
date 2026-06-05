/**
 * Mock for CSS/SCSS module imports in Jest
 *
 * Returns an empty object so that `styles.className` resolves to
 * the string "className" (identity proxy) for querying in tests.
 */

// Return false for __esModule so ts-jest's __importDefault wraps this as
// { default: proxy } rather than treating it as a real ES module and
// returning the string "default" as the styles object.
module.exports = new Proxy(
  {},
  {
    get: function (_target, key) {
      if (key === "__esModule") return false;
      if (typeof key === "symbol") return undefined;
      return key;
    },
  }
);
