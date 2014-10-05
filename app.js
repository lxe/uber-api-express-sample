var express = require('express');
var assert = require('assert');
var passport = require('passport');
var request = require('request');
var session = require('cookie-session')
var passportOauth = require('passport-oauth');
var OAuth2Strategy = passportOauth.OAuth2Strategy;

var app = express();

// Configuration
var port = process.env.PORT || 3000;

// See 'callbackURL' below
var oauthCallbackRoute = '/oauth/callback'

var authConfig = {
  // Leave these the same
  authorizationURL: 'https://login.uber.com/oauth/authorize',
  tokenURL:         'https://login.uber.com/oauth/token',

  // Scopes are 'profile', 'history', and 'history_lite'.
  // See endpoint docs at https://developer.uber.com/v1/endpoints/ for required scopes
  scope: 'profile',

  // This should match the callback URL you've set up for your app at https://login.uber.com/applications
  // It must also be accessible via browser! For local development, make sure you've set up a local
  // callback URI (http://localhost:3000/oauth/callback for example)
  callbackURL: 'http://localhost:' + port + oauthCallbackRoute,

  // The client ID and you've set up at https://login.uber.com/applications
  clientID: 'd8MkHnACohgcvtEMS_ZJdZRsOdqwRFTt',

  // You should pass it as environment variables to the app:
  // OAUTH_CLIENT_SECRET=secret node app
  // I don't recommend hard coding the client secret.
  clientSecret: process.env.OAUTH_CLIENT_SECRET
};

passport.use('uberAuth', new OAuth2Strategy(authConfig,
  function(accessToken, refreshToken, profile, done) {
    // For simplicity's sake accessToken is the user.
    return done(null, accessToken);
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

//
// Express Settings
//

// Set if you do SSL outside of node
// app.set('trust proxy');

app.use(session({
  // Pass the session keys via environment variables. I don't recommend hard coding the session keys.
  // SESSION_KEYS=secret1,secret2 node app
  keys: process.env.SESSION_KEYS.split(','),
  // Set to true if you do SSL outside of node
  secureProxy: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(require('morgan')('dev'));

app.get(oauthCallbackRoute, passport.authenticate('uberAuth', {
  failureRedirect: '/',
}), function (req, res) {
  res.redirect('/')
});

// Inject 'uberAPIMiddleware' into all routes that require auth and Uber API
function uberAPIMiddleware (req, res, next) {
  // Always authenticate user
  if (!req.session.passport.user) {
    return passport.authenticate('uberAuth')(req, res, next);
  }

  req.uberAPIRequest = function (path, params, done) {
    var options = { };
    options.qs = params;
    options.uri = 'https://api.uber.com/v1' + path;
    options.json = true;
    options.headers = {
      'Authorization': 'Bearer ' + req.session.passport.user
    };

    return request.get(options, function (err, response, body) {
      if (err) return done(err);
      done(null, body);
    });
  };

  next();
};

//
// Application logic goes here
//
app.get('/', uberAPIMiddleware, function (req, res, next) {
  req.uberAPIRequest('/me', { }, function (err, data) {
    if (err) return next(err);
    res.json(data);
  });
});

app.listen(port, function () {
  console.log('Sample app listnening on %d', port);
});
