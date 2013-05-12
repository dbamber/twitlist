var express = require('express');
var oauth = require('oauth');
var config = require('./config.js');
var when = require('when');

var app = express();

function consumer() {
	return new oauth.OAuth(
		"https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token",
	config.twitterConsumerKey, config.twitterConsumerSecret, "1.0A", config.domain + "/callback", "HMAC-SHA1");
};

function request(url, req) {
	var deferred = when.defer();
	consumer().get(url, req.session.oauthAccessToken, req.session.oauthAccessTokenSecret, function(error, data, response) {
		if (error) {
			console.log('error');
			deferred.reject(error);
		} else {
			deferred.resolve(data);
		}
	});
	return deferred.promise;
};

app.use(express.static(__dirname + '/public'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({
	secret: 'secretkey'
}));


app.get('/', function(req, res) {
	res.redirect('index.htm');
});

app.get('/api/credentials', function(req, res) {
	request("https://api.twitter.com/1.1/account/verify_credentials.json", req).then(function(data) {
		res.send(data);
	}).otherwise(function() {
		res.send('oops');
	});
});

app.get('/api/lists', function(req, res) {
	console.log('lists');

	request('https://api.twitter.com/1.1/lists/ownerships.json?count=1000', req).then(function(data) {
		var promises = [];
		data = JSON.parse(data);

		for (var i = 0; i < data.lists.length; i++) {
			var list = data.lists[i];

			var scoped = (function(list) {
				return function(data) {
					data = JSON.parse(data);
					return {
						id: list.id,
						name: list.name,
						members: data.users.map(function(user) {
							return user.id
						})
					};
				};
			});

			var promise = request('https://api.twitter.com/1.1/lists/members.json?list_id=' + list.id, req).then(scoped(list));

			promises.push(promise);
		}

		when.all(promises).then(function(items) {
			res.send(items);
		});
		
	}).otherwise(function(error) {
		console.log(error);
		res.send('oops');
	});
});

app.post('/api/details', function(req, res) {
	var request = {
		user_id: req.body.join()
	};
	console.log(request);

	consumer().post('https://api.twitter.com/1.1/users/lookup.json', req.session.oauthAccessToken, req.session.oauthAccessTokenSecret, request, function(error, data, response) {

		console.log('done');
		if (error) {
			console.log('error');
			res.send('oops');
		} else {
			res.send(data);
		}
	});
});

app.get('/api/friends', function(req, res) {
	request('https://api.twitter.com/1.1/friends/ids.json?screen_name=' + req.session.screen_name, req).then(function(data) {
		res.send(data);
	}).otherwise(function() {
		res.send('oops');
	});
});


app.get('/test', function(req, res) {
	request("https://api.twitter.com/1.1/account/verify_credentials.json", req).then(function(data) {
		res.send('You are signed in: ' + data["screen_name"]);
	}).otherwise(function() {
		res.send('oops');
	});
});

app.get('/callback', function(req, res) {
	consumer().getOAuthAccessToken(req.session.oauthRequestToken, req.session.oauthRequestTokenSecret, req.query.oauth_verifier, function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
		if (error) {
			res.send("Error getting OAuth access token : " + error + "[" + oauthAccessToken + "]" + "[" + oauthAccessTokenSecret + "]" + "[" + results + "]", 500);
		} else {
			req.session.oauthAccessToken = oauthAccessToken;
			req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;

			request("https://api.twitter.com/1.1/account/verify_credentials.json", req).then(function(data) {
				req.session.screen_name = data['screen_name'];
				res.redirect('/app.htm');
			});

		}
	});
});

app.get('/login', function(req, res) {
	consumer().getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results) {
		if (error) {
			res.send("Error getting OAuth request token : " + sys.inspect(error), 500);
		} else {
			req.session.oauthRequestToken = oauthToken;
			req.session.oauthRequestTokenSecret = oauthTokenSecret;
			res.redirect("https://twitter.com/oauth/authenticate?oauth_token=" + req.session.oauthRequestToken);
		}
	});
});

app.listen(80);