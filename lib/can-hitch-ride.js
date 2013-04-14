var async = require('async');
var googleMapsAPI = require('./google-maps').directions;

var tolerance = 1.1;

var canHitchRide = module.exports = function (opts, cb) {
  var withRider = {
    origin: opts.driver.from,
    destination: opts.driver.to,
    waypoints: [ opts.rider.from, opts.rider.to ].join('|'),
    sensor: false
  };

  var withoutRider = {
    origin: opts.driver.from,
    destination: opts.driver.to,
    sensor: false
  };

  async.map([
    withRider,
    withoutRider
  ], googleMapsAPI, function(err, results) {

    if (err) {
      //TODO
      cb(false);
      return;
    }

    var durations = results.map(function (way) {
      return way.routes[0].legs.reduce(function (sum, leg) {
        return sum + leg.duration.value;
      }, 0);
    });

    cb(durations[0] <= durations[1] * tolerance, results[0]);
  });
};
