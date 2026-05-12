/**
 * Mock for CSS/SCSS module imports in Jest
 *
 * Returns an empty object so that `styles.className` resolves to
 * the string "className" (identity proxy) for querying in tests.
 */

module.exports = new Proxy(
  {},
  {
    get: function (_target, key) {
      return key;
    },
  }
);
