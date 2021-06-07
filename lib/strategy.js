/**
 * Module dependencies.
 */
let util = require('util')
    , querystring = require('querystring')
    , fetch = require('node-fetch')
    , OAuth2Strategy = require('passport-oauth2').Strategy
    , InternalOAuthError = require('passport-oauth2').InternalOAuthError;

/**
 * `Strategy` constructor.
 *
 * The Clever authentication strategy authenticates requests by delegating to
 * Clever using the OAuth 2.0 protocol.
 *
 * Applications must specify a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `clientID`      Clever application's client id
 *   - `clientSecret`  Clever application's client secret
 *   - `callbackURL`   URL to which Clever will redirect the user after granting authorization
 *
 * Examples:
 *
 *     passport.use(new CleverStrategy({
 *         clientID: "<client id>",
 *         clientSecret: "<client secret>",
 *         callbackURL: "<callback url>",
 *         passReqToCallback: true
 *       }, function(req, accessToken, refreshToken, profile, done) {
 *         User.findOrCreate({ cleverId: profile.data.id }, function(err, user) {
 *           return done(err, user);
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
    this._passReqToCallback = options.passReqToCallback;

    this._oauth2.useAuthorizationHeaderforGET(true);
    this._oauth2.getOAuthAccessToken = function (code, params, callback) {
        var params = params || {};
        var codeParam = (params.grant_type === 'refresh_token') ? 'refresh_token' : 'code';

        params[codeParam] = code;

        var post_data = querystring.stringify(params);
        var post_headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(this._clientId + ":" + this._clientSecret).toString('base64')
        };

        this._request("POST", this._getAccessTokenUrl(), post_headers, post_data, null, function (error, data, response) {
            if (error) {
                console.log("error");
                callback(error);
            } else {
                var results;

                try {
                    results = JSON.parse(data);
                } catch (e) {
                    results = querystring.parse(data);
                }

                let access_token = results["access_token"];
                let refresh_token = results["refresh_token"];
                delete results["refresh_token"];
                callback(null, access_token, refresh_token, results);
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
 *   - `sections`
 *         - `grade`
 *         - `id`
 *         - `name`
 *         - `students` (Array)
 *         -  `subject`
 *         - `teacher`
 *         - `teachers` (Array)
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */
OAuth2Strategy.prototype.userProfile = function (accessToken, done) {
    let options = {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
        }
    };

    function getMe(options) {
        fetch('https://api.clever.com/v2.1/me', options)
            .then(response => response.json())
            .then(data => {
                let link = data.links.filter(obj => {
                    if (obj.rel == "canonical") {
                        return obj;
                    }
                });

                let user = data.data;

                getUserInfo(link[0].uri, user, options);
            })
            .catch(error => {
                return done(error);
            });
    }

    function getUserInfo(link, user, options) {
        fetch(`https://api.clever.com/${link}`, options)
            .then(response => response.json())
            .then(info => {
                user.email = info.data.email;
                user.name = info.data.name;

                if (user.type === "teacher") {
                    getUserSectionsWithStudents(user, options);
                } else {
                    return done(null, user);
                }
            })
            .catch(error => {
                return done(error);
            });
    }

    let studentsBySection = [];

    function getUserSectionsWithStudents(user, options) {
        fetch(`https://api.clever.com/v2.1/${user.type}s/${user.id}/sections`, options)
            .then(response => response.json())
            .then(async info => {
                let sections = info.data;

                // for every section, go fetch the data for each of its students
                await Promise.all(sections.map(async section => {
                    await getStudentsForSection(section.data.id, options);
                }));

                let sectionsWithStudents = sections.map((section, index) => {
                    let newSection = section.data;
                    newSection.students = studentsBySection[index];

                    return newSection;
                });

                user.sections = sectionsWithStudents;

                return done(null, user);
            })
            .catch(error => {
                return done(error);
            });
    }

    async function getStudentsForSection(section_id, options) {
        await fetch(`https://api.clever.com/v2.1/sections/${section_id}/students`, options)
            .then(response => response.json())
            .then(info => {
                let studentsForSection = [info.data[0].data];

                studentsBySection.push(studentsForSection);
            })
            .catch(error => {
                return done(error);
            });
    }

    getMe(options);
};

/**
 * Expose `Strategy`.
 */
module.exports = Strategy;