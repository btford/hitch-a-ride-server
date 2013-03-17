/*
 * Serve content over a socket
 */

var _ = require('lodash');

// map key(trip) -> { trip }
var riders = {};
var drivers = {};

// map socket.id -> [ {trip} , {trip} , ... ]
var trips = {};


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


var addTrip = function (trip) {
  if (!trips[trip.socket.id]) {
    trips[trip.socket.id] = [];
  }
  trips[trip.socket.id].push(trip);
};

var key = function (trip) {
  return trip.from.toString() + ':' +
    trip.to.toString() + ':' +
    trip.socket.id;
};


module.exports = function (socket) {

  socket.on('send:rider:trip', function (data, fn) {
    console.log(data);
    var newTrip = {
      socket: socket,
      from: data.from,
      to: data.to
    };

    riders[key(newTrip)] = newTrip;
    addTrip(newTrip);

    fn();
    checkMatches();
  });

  socket.on('send:driver:trip', function (data, fn) {
    console.log(data);
    var newTrip = {
      socket: socket,
      from: data.from,
      to: data.to
    };

    drivers[key(newTrip)] = newTrip;
    addTrip(newTrip);
    
    fn();
    checkMatches();
  });

  socket.on('get:trips', function (data, fn) {
    var myTrips = trips[socket.id] || [];
    fn(myTrips.map(function (trip) {
      return {
        from: trip.from,
        to: trip.to
      };
    }));
  });

  // clean up if someone disconnects before being matched
  socket.on('disconnect', function () {
    if (riders[socket.id]) {
      delete riders[socket.id];
    }
    if (drivers[socket.id]) {
      delete drivers[socket.id];
    }
  });
};
