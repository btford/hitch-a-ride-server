/*
 * Serve content over a socket
 */

var _ = require('lodash');

var riders = {};
var drivers = {};

var canHitchRide = require('../lib/can-hitch-ride');

var checkMatches = function () {

  _.each(drivers, function (driver) {
    _.each(riders, function (rider) {
      canHitchRide({
        driver: driver,
        rider: rider
      }, function (canHitch) {
        console.log(driver.from, rider.from);
        if (canHitch &&
            drivers[driver.socket.id] &&
            riders[rider.socket.id]) {

          delete drivers[driver.socket.id];
          delete riders[rider.socket.id];

          driver.socket.emit('trip:matched');
          rider.socket.emit('trip:matched');

          console.log('matched!');
        } else {
          console.log('not matched!');
        }
      });
    });
  });

};

module.exports = function (socket) {

  socket.on('send:rider:trip', function (data, fn) {
    console.log(data);
    riders[socket.id] = {
      socket: socket,
      from: data.from,
      to: data.to
    };
    fn();
    checkMatches();
  });

  socket.on('send:driver:trip', function (data, fn) {
    console.log(data);
    drivers[socket.id] = {
      socket: socket,
      from: data.from,
      to: data.to
    };
    fn();
    checkMatches();
  });
};
