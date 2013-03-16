var request = require('request');
var querystring = require('querystring');

/*
var reqOptions = {
  origin: "Chicago, IL",
  destination: "Los Angeles, CA",
  waypoints: [
    {
      location:"Joplin, MO",
      stopover:false
    },{
      location:"Oklahoma City, OK",
      stopover:true
    }],
  provideRouteAlternatives: false,
  travelMode: TravelMode.DRIVING,
  unitSystem: UnitSystem.IMPERIAL
};
*/

/*
 * opts = {
 *   driver: {
 *     from: '...',
 *     to: '...'
 *   },
 *   rider: {
 *     from: '...',
 *     to: '...' 
 *   }
 * }
 *
 * cb(err, bool) // arg in callback true iff it is reasonable to hitch a ride
 */

var googleMapsAPI = module.exports = function (opts, cb) {
  var url = 'https://maps.googleapis.com/maps/api/directions/json?' +
    querystring.stringify(opts);

  request({url : url, json: true}, function (err, status, body) {
    //console.log(JSON.stringify(body, null, 2));
    cb(err, body);
  });
};
