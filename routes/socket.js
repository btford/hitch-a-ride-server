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

var key = function (trip) {
  return trip.from.toString() + ':' +
    trip.to.toString() + ':' +
    trip.socket.id;
};

var checkMatches = function () {

  _.each(drivers, function (driver) {
    _.each(riders, function (rider) {
      canHitchRide({
        driver: driver,
        rider: rider
      }, function (canHitch, route) {
        if (canHitch) {

          delete drivers[key(driver)];
          delete riders[key(rider)];

          driver.socket.emit('trip:matched', 1);
          rider.socket.emit('trip:matched', 1);

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


module.exports = function (socket) {

  socket.on('send:rider:trip', function (data, fn) {
    console.log(data);
    var newTrip = {
      socket: socket,
      from: data.from,
      to: data.to,
      type: 'ride'
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
      to: data.to,
      type: 'drive'
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
        to: trip.to,
        type: trip.type
      };
    }));
  });

  // clean up if someone disconnects before being matched
  socket.on('disconnect', function () {
    if (trips[socket.id]) {
      trips[socket.id].forEach(function (trip) {
        if (drivers[key(trip)]) {
          delete drivers[key(trip)];
        }
        if (riders[key(trip)]) {
          delete riders[key(trip)];
        }
      });

      delete trips[socket.id];
    }
  });
};
