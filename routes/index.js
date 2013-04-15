/*
 * GET home page.
 */

var fs = require('fs');

exports.index = function(req, res){
  res.render('index.jade');
};

exports.appIndex = function (req, res) {
  res.set('Content-Type', 'text/html');
  fs.readFile(__dirname + '/../node_modules/hitch-a-ride-client/app/index.html',
    { encoding: 'utf8' },
    function (err, html) {

      if (!req.query.gap) {
        html = html.toString()
          .replace(new RegExp("<!-- start phonegap -->[\\s\\S]*?<!-- end phonegap -->", "g"), '')
          .replace(new RegExp("<!-- start web", "g"), '')
          .replace(new RegExp("end web -->", "g"), '');
      }

      res.write(html);

      res.end();
    });
};

exports.partials = function (req, res) {
    var name = req.params.name;
    res.render('partials/' + name + '.jade');
};
