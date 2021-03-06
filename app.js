
/**
 * Module dependencies.
 */

var express = require('express'),
  routes = require('./routes'),
  socket = require('./routes/socket.js');

var app = module.exports = express();
var server = require('http').createServer(app);

// Session
var secret = 'a';
var cookieParser = express.cookieParser(secret);
var sessionStore = new express.session.MemoryStore();

// Hook Socket.io into Express
var io = require('socket.io').listen(server);
io.set('authorization', function(data, accept) {
  cookieParser(data, {}, function(err) {
    if (err) {
      accept(err, false);
    } else {
      sessionStore.get(data.signedCookies['express.sid'], function(err, session) {
        if (err || !session) {
          accept('Session error', false);
        } else {
          data.session = session;
          data.sessionId = data.signedCookies['express.sid'];
          accept(null, true);
        }
      });
    }
  });
});

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());

  app.use(cookieParser);
  app.use(express.session({
    store: sessionStore,
    secret: secret,
    key: 'express.sid'
  }));

  app.use(express.static(__dirname + '/public'));

  // serve shared styles
  ['img', 'styles'].forEach(function (path) {
    app.use('/' + path, express.static(__dirname + '/components/hitch-a-ride-style/' + path));
  });

  // serve the web app
  app.use(function (req, res, next) {
    if (req.path === '/app/') {
      routes.appIndex(req, res);
    } else {
      next();
    }
  });
  app.use('/app', express.static(__dirname + '/node_modules/hitch-a-ride-client/app'));
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes
app.get('/', routes.index);
app.get('/app/*', routes.appIndex);
app.get('/app/*', routes.appIndex);
app.get('/partials/:name', routes.partials);


// redirect all others to the index (HTML5 history)
app.get('*', routes.index);

// Socket.io Communication

io.sockets.on('connection', socket);

// Start server

server.listen(3047, function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
