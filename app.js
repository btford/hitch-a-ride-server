
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

var passport = require('passport'),
    GoogleStrategy = require('passport-google').Strategy;

passport.serializeUser(function(user,done) {
  done(null, user);
});

passport.deserializeUser(function(obj,done) {
  done(null, obj);
});
passport.use(new GoogleStrategy ({
  returnURL: 'http://localhost:3000/auth/google/return',
  realm: 'http://localhost:3000/'
},
function(identifier, profile, done) {
  process.nextTick(function() {
    profile.identifier = identifier;
    return done(null, profile);
  });	
}));

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  //app.engine('.html', require('jade').__express);
  //app.set('view engine', 'html');
  app.use(express.bodyParser());
  app.use(express.methodOverride());

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(cookieParser);
  app.use(express.session({
    store: sessionStore,
    secret: secret,
    key: 'express.sid'
  }));

  app.use(express.static(__dirname + '/public'));
  // serve the web app
  app.use('/app', express.static(__dirname + '/node_modules/hitch-a-ride-client/app'));
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

function ensureAuth(req, res, next){
	console.log('this is a test');
	if(req.isAuthenticated()) { return next(); }
       res.redirect('/')
}
// Routes
app.get('/', routes.index);
/*app.get('/app', function(req, res){
  res.render(__dirname + '/node_modules/hitch-a-ride-client/app/index.html');	    
});*/
app.get('/app/*', ensureAuth, routes.appIndex);
app.get('/partials/:name', ensureAuth, routes.partials);
app.get('/auth/google',
	passport.authenticate('google', { failureRedirect: '/'}),
	function(req, res) {
	  res.redirect('/app');
	});
app.get('/auth/google/return',
	passport.authenticate('google', {failureRedirect: '/'}),
	function(req, res){
	  res.redirect('/app');
	});
// redirect all others to the index (HTML5 history)
app.get('*', routes.index);

// Socket.io Communication

io.sockets.on('connection', socket);

// Start server

server.listen(3000, function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
