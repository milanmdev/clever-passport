let util = require('util'),
  querystring = require('querystring'),
  fetch = require('node-fetch'),
  OAuth2Strategy = require('passport-oauth2').Strategy,
  InternalOAuthError = require('passport-oauth2').InternalOAuthError;

/**
 * `Strategy` constructor.
 *
 * The Clever authentication strategy authenticates requests by delegating to
 * Clever using the OAuth 2.0 protocol.
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `clientID`      Clever application's app key
 *   - `clientSecret`  Clever application's app secret
 *   - `callbackURL`   URL to which Clever will redirect the user after granting authorization
 *
 * Examples:
 *
 *     passport.use(new CleverStrategy({
 *         clientID: 'app key',
 *         clientSecret: 'app secret'
 *         callbackURL: 'https://www.example.net/auth/clever/callback'
 *       },
 *       function(accessToken, refreshToken, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
  options = options || {};
  options.authorizationURL = options.authorizationURL || 'https://clever.com/oauth/authorize';
  options.tokenURL = options.tokenURL || 'https://clever.com/oauth/tokens';

  OAuth2Strategy.call(this, options, verify);
  this.name = 'clever';

  this._oauth2.useAuthorizationHeaderforGET(true);
  this._oauth2.getOAuthAccessToken = function(code, params, callback) {
    var params = params || {};
    var codeParam = (params.grant_type === 'refresh_token') ? 'refresh_token' : 'code';
    params[codeParam] = code;

    var post_data = querystring.stringify(params);
    var post_headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(this._clientId + ":" + this._clientSecret).toString('base64')
    };

    this._request("POST", this._getAccessTokenUrl(), post_headers, post_data, null, function(error, data, response) {
      if (error) {
        callback(error);
      } else {
        var results;
        try {
          results = JSON.parse(data);
        } catch (e) {
          results = querystring.parse(data);
        }
        var access_token = results["access_token"];
        var refresh_token = results["refresh_token"];
        delete results["refresh_token"];
        callback(null, access_token, refresh_token, results); // callback results
      }
    });
  }
}

/**
 * Inherit from `OAuth2Strategy`.
 */
util.inherits(Strategy, OAuth2Strategy);

/**
 * Retrieve user profile from Clever for Instant Login.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `id`
 *   - `name`
 *   - `email`
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */

OAuth2Strategy.prototype.userProfile = function(accessToken, done) {
  var options = {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    }
  };

  function userDetails(link, options) {
    fetch(`https://api.clever.com/${link}`, options)
      .then(response => response.json())
      .then(info => {
        return done(null, info);
      })
      .catch(error => {
        return done(error);
      })
  }

  fetch('https://api.clever.com/v2.1/me', options)
    .then(response => response.json())
    .then(data => {
      var link = data.links.filter(obj => {
        if (obj.rel == "canonical") {
          return obj;
        }
      })
      userDetails(link[0].uri, options);
    })
    .catch(error => {
      return done(error);
    })
};

/**
 * Expose `Strategy`.
 */
module.exports = Strategy;
