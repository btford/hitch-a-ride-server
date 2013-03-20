/*
 * Serve content over a socket
 */

var _ = require('lodash');

// map of unmatched trips
// map key(trip) -> { trip }
var riders = {};
var drivers = {};

// map id(socket) -> [ {trip} , {trip} , ... ]
var trips = {};


var canHitchRide = require('../lib/can-hitch-ride');

var key = function (trip) {
  return trip.from.toString() + ':' +
    trip.to.toString() + ':' +
    id(trip.socket);
};

var checkMatches = function () {

  _.each(drivers, function (driver) {
    _.each(riders, function (rider) {

      // a person cannot give themself a ride
      if (id(driver.socket) === id(rider.socket)) {
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
  if (!trips[id(trip.socket)]) {
    trips[id(trip.socket)] = [];
  }
  trips[id(trip.socket)].push(trip);
};

var id = function (socket) {
  return socket.sessionId;
};

module.exports = function (socket) {
  socket.session = socket.handshake.session;
  socket.sessionId = socket.handshake.sessionId;

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
    var myTrips = trips[id(socket)] || [];
    fn(myTrips.map(function (trip) {
      return {
        from: trip.from,
        to: trip.to,
        type: trip.type
      };
    }));
  });

  socket.on('get:trip:info', function (data, fn) {
    var trip = _.find(trips[id(socket)], function (trip) {
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
        serialized.match = id(trip.match.socket);
      }

      fn(serialized);
    } else {
      fn(false);
    }

  });

  // clean up if someone disconnects before being matched
  /*
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
  */
};
