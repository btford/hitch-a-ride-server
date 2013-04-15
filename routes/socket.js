/*
 * Serve content over a socket
 */

var _ = require('lodash');

// map of unmatched trips
// map key(trip) -> { trip }
var riders = {};
var drivers = {};



// map accountId -> [ {trip} , {trip} , ... ]
var trips = {};
var history = {};


// accountId -> account data (reliability, etc.)
var profiles = {};

// a profile looks like this:
// {
//    notifications: [
//      {what: 'rider canceled for trip', trip: 'some-id'},
//      {what: 'trip matched for', trip: 'some-id'}
//    ]
// }
//

var newProfile = function (data) {
  data.notifications = [];
  data.stats = {
    success: 0,
    late: 0,
    cancelled: 0,
    noshow: 0
  };

  // TODO: query google for name, profile pic, phone number, etc.

  return data;
};


// Account id -> socket
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
    trip.accountId);
};

var checkMatches = function () {

  _.each(drivers, function (driver) {
    _.each(riders, function (rider) {

      // a person cannot give themself a ride
      if (driver.accountId === rider.accountId) {
        return;
      }

      canHitchRide({
        driver: driver,
        rider: rider
      }, function (canHitch, data) {
        if (canHitch) {

          delete drivers[key(driver)];
          delete riders[key(rider)];

          // update list of notifications
          profiles[driver.accountId].notifications.push({
            trip: driver.id,
            message: 'A rider was found for your trip to ' + driver.to,
            time: Date.now()
          });

          profiles[rider.accountId].notifications.push({
            trip: rider.id,
            message: 'A driver was found for your trip to ' + rider.to,
            time: Date.now()
          });

          // send new notifications
          if (sockets[driver.accountId]) {
            try {
              sockets[driver.accountId].emit('update:notifications', profiles[driver.accountId].notifications);
            } catch(e) {}
          }
          if (sockets[rider.accountId]) {
            try {
              sockets[rider.accountId].emit('update:notifications', profiles[rider.accountId].notifications);
            } catch(e) {}
          }

          driver.match = rider;
          rider.match = driver;
          driver.status = 'matched';
          rider.status = 'matched';

          driver.route = rider.route = data.routes[0];

          console.log('matched!');
        } else {
          console.log('not matched!');
        }
      });
    });
  });

};


var addTrip = function (trip) {
  if (!trips[trip.accountId]) {
    trips[trip.accountId] = [];
  }
  trips[trip.accountId].push(trip);
};

var serializeTrip = function (trip) {
  // TODO
};

module.exports = function (socket) {
  socket.session = socket.handshake.session;
  socket.sessionId = socket.handshake.sessionId;


  socket.on('set:account', function (data) {
    socket.accountId = data.id;

    if (!profiles[socket.accountId]) {
      profiles[socket.accountId] = newProfile(data);
    }
    if (!history[socket.accountId]) {
      history[socket.accountId] = [];
    }

    sockets[socket.accountId] = socket;
  });



  socket.on('send:rider:trip', function (data, fn) {
    var newTrip = {
      from: data.from,
      to: data.to,
      type: 'ride',
      accountId: socket.accountId,
      status: 'open'
    };
    newTrip.id = key(newTrip);

    riders[newTrip.id] = newTrip;
    addTrip(newTrip);

    fn();
    checkMatches();
  });

  socket.on('send:profile', function (data, fn) {
    if (!data || !data.id) {
      data = {
        id: socket.accountId
      };
    }
    if (profiles[data.id]) {
      fn(profiles[data.id]);
    } else {
      fn(false);
    }
  });

  socket.on('send:driver:trip', function (data, fn) {
    var newTrip = {
      from: data.from,
      to: data.to,
      type: 'drive',
      accountId: socket.accountId,
      status: 'open'
    };
    newTrip.id = key(newTrip);

    drivers[newTrip.id] = newTrip;
    addTrip(newTrip);

    fn();
    checkMatches();
  });

  socket.on('cancel:driver:trip', function (data, fn) {

    var trip = _.find(trips[socket.accountId], function (trip) {
      return trip.id === data.id;
    });

    if (trip.match) {
      profiles[trip.match.accountId].notifications.push({
        trip: trip.match.id,
        message: 'Your driver canceled for your trip to ' + trip.match.to,
        time: Date.now()
      });
      if (sockets[trip.match.accountId]) {
        sockets[trip.match.accountId].emit('update:notifications', profiles[trip.match.accountId].notifications);
      }

      riders[trip.match.id] = trip.match;
      trip.match.route = null;
      trip.route = null;
      trip.match.match = null;
      trip.match = null;

      profiles[socket.accountId].stats.canceled += 1;
    } else {
      delete drivers[data.id];
    }
    trips[socket.accountId].splice(trips[socket.accountId].indexOf(trip), 1);
    trip.status = 'canceled';
    history[socket.accountId].push(trip);

    fn();
  });


  socket.on('finish:trip', function (data, fn) {

    var trip = _.find(trips[socket.accountId], function (trip) {
      return trip.id === data.id;
    });
    if (!trip) {
      return;
    }
    trip.status = data.status;

    trips[trip.accountId].splice(trips[trip.accountId].indexOf(trip), 1);
    history[trip.accountId].push(trip);
    /*
    success: 0,
    late: 0,
    cancelled: 0,
    noshow: 0
    */
    try {
      profiles[trip.match.accountId].stats[data.status] += 1;
    } catch (e) {
      console.log(e.stack);
    }

    fn();
  });


  socket.on('cancel:rider:trip', function (data, fn) {

    var trip = _.find(trips[socket.accountId], function (trip) {
      return trip.id === data.id;
    });

    // TODO: save this to a person's reliability
    // notify of <something>

    if (trip.match) {
      profiles[trip.match.accountId].notifications.push({
        trip: trip.match.id,
        message: 'Your rider canceled for your trip to ' + trip.match.to,
        time: Date.now()
      });
      if (sockets[trip.match.accountId]) {
        sockets[trip.match.accountId].emit('update:notifications', profiles[trip.match.accountId].notifications);
      }

      // this trip can be matched again
      drivers[trip.match.id] = trip.match;
      trip.match.route = null;
      trip.route = null;
      trip.match.match = null;
      trip.match = null;

      // lower rating
      profiles[socket.accountId].stats.canceled += 1;
    } else {
      delete riders[data.id];
    }
    trips[socket.accountId].splice(trips[socket.accountId].indexOf(trip), 1);
    trip.status = 'canceled';
    history[socket.accountId].push(trip);

    fn();
  });

  socket.on('reverse:geocode', reverseGeocode);

  socket.on('get:trips', function (data, fn) {
    var myTrips = trips[socket.accountId] || [];
    fn(myTrips.map(function (trip) {
      return {
        from: trip.from,
        to: trip.to,
        type: trip.type,
        id: trip.id,
        status: trip.status
      };
    }));
  });

  socket.on('get:history', function (data, fn) {
    var myTrips = history[socket.accountId] || [];
    fn(myTrips.map(function (trip) {
      return {
        from: trip.from,
        to: trip.to,
        type: trip.type,
        id: trip.id,
        status: trip.status
      };
    }));
  });

  socket.on('get:notifications', function (data, fn) {
    if (socket.accountId) {
      try {
        sockets[socket.accountId].emit('update:notifications', profiles[socket.accountId].notifications);
      } catch (e) {}
    } else {
      fn([]);
    }
  });

  socket.on('get:trip:info', function (data, fn) {
    var trip = _.find(trips[socket.accountId], function (trip) {
      return trip.id === data.id;
    });

    if (trip) {
      var serialized = {
        from: trip.from,
        to: trip.to,
        type: trip.type,
        route: trip.route,
        id: trip.id,
        status: trip.status
      };

      if (trip.match) {
        serialized.match = {
          name: profiles[trip.match.accountId].name,
          picture: profiles[trip.match.accountId].picture
        };
      }

      fn(serialized);
    } else {
      fn(false);
    }

  });
  socket.on('get:history:info', function (data, fn) {
    var trip = _.find(history[socket.accountId], function (trip) {
      return trip.id === data.id;
    });

    if (trip) {
      var serialized = {
        from: trip.from,
        to: trip.to,
        type: trip.type,
        route: trip.route,
        id: trip.id,
        status: trip.status
      };

      if (trip.match) {
        serialized.match = trip.match.accountId;
      }

      fn(serialized);
    } else {
      fn(false);
    }

  });

  // clean up if someone disconnects before being matched
  socket.on('disconnect', function () {
    if (sockets[socket.accountId]) {
      delete sockets[socket.accountId];
    }
  });
};
