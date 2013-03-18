/*
 * Serve content over a socket
 */

var _ = require('lodash');

// map of unmatched trips
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

      // a person cannot give themself a ride
      if (driver.socket.id === rider.socket.id) {
        return;
      }

      canHitchRide({
        driver: driver,
        rider: rider
      }, function (canHitch, data) {
        if (canHitch) {

          delete drivers[key(driver)];
          delete riders[key(rider)];

          driver.socket.emit('trip:matched');
          rider.socket.emit('trip:matched');


          driver.match = rider;
          rider.match = driver;
          driver.route = data.routes[0];
          rider.route = data.routes[0];

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

  socket.on('get:trip:info', function (data, fn) {
    var trip = _.find(trips[socket.id], function (trip) {
      return trip.from === data.from &&
        trip.to === data.to &&
        trip.type === data.type;
    });

    if (trip) {
      var serialized = {
        from: trip.from,
        to: trip.to,
        type: trip.type,
        route: trip.route
      };

      if (trip.match) {
        serialized.match = trip.match.socket.id;
      }

      fn(serialized);
    } else {
      fn(false);
    }

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
