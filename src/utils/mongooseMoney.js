// Helper to store money as integers (paise) but work with floats (rupees)
// set: 100 -> 10000 (DB)
// get: 10000 -> 100 (App)

function getPrice(num) {
  return (num / 100).toFixed(2); // Always return 2 decimal string or float
}

function setPrice(num) {
  return Math.round(num * 100);
}

module.exports = { type: Number, get: getPrice, set: setPrice };