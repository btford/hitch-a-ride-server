
var canHitchRide = require('../lib/can-hitch-ride');

// Example:
canHitchRide({
  driver: {
    from: "Chicago, IL",
    to: "Los Angeles, CA"
  },
  rider: {
    from: "Tijuana, Mexico",
    to: "Oklahoma City, OK"
  }
}, function (canHitch) {
  console.log(canHitch);
});
