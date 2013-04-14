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

// google account id -> account data (reliability, etc.)
var accounts = {};

// account -> socket
var sockets = {};

var crypto = require('crypto');
var sha1 = function (str) {
  var shasum = crypto.createHash('sha1');
  shasum.update(str);
  return shasum.digest('hex');
};

var canHitchRide = require('../lib/can-hitch-ride');
var reverseGeocode = require('../lib/google-maps').reverseGeocode;

var key = function (trip) {
  return sha1(trip.from.toString() + ':' +
    trip.to.toString() + ':' +
    id(trip.socket));
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
    newTrip.id = key(newTrip);

    riders[key(newTrip)] = newTrip;
    addTrip(newTrip);

    fn();
    checkMatches();
  });

  socket.on('send:profile', function (id, fn) {
    if (profile[id]) {
      fn(profile[id]);
    } else {
      fn(false);
    }
  });

  socket.on('send:driver:trip', function (data, fn) {
    var newTrip = {
      socket: socket,
      from: data.from,
      to: data.to,
      type: 'drive'
    };
    newTrip.id = key(newTrip);

    drivers[key(newTrip)] = newTrip;
    addTrip(newTrip);

    fn();
    checkMatches();
  });

  socket.on('reverse:geocode', reverseGeocode);

  socket.on('get:trips', function (data, fn) {
    var myTrips = trips[id(socket)] || [];
    fn(myTrips.map(function (trip) {
      return {
        from: trip.from,
        to: trip.to,
        type: trip.type,
        id: trip.id
      };
    }));
  });

  socket.on('get:trip:info', function (data, fn) {
    var trip = _.find(trips[id(socket)], function (trip) {
      return trip.id === data.id;
    });

    if (trip) {
      var serialized = {
        from: trip.from,
        to: trip.to,
        type: trip.type,
        route: trip.route,
        id: trip.id
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
