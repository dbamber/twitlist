angular.module('TwitterList', []).factory('TwitterList', function($http, $q) {
	var deferred = $q.defer();


	var methods = {
		query: function() {

			$http.get('/api/lists', {
				cache: true
			}).success(function(data) {
				deferred.resolve(data);
			});

			return deferred.promise;
		},
	};
	return methods;
});

angular.module('Friends', []).factory('FriendsList', function($http, $q) {
	var deferred = $q.defer();

	return {
		query: function() {
			$http.get('/api/friends', {
				cache: true
			}).success(function(data) {
				deferred.resolve(data);
			});

			return deferred.promise;
		}
	}
});


angular.module('PagedFriendsDetails', ['PagedFriendsList']).factory('PagedFriendsDetails', function($http, $q, PagedFriendsList) {
	var promises = {};

	var getPromise = function(page) {
		if (promises[page]) {
			return promises[page].promise;
		}

		var deffered = $q.defer();

		PagedFriendsList.get(page).then(function(data) {
			$http.post('/api/details', data).success(function(data) {
				deffered.resolve(data);
			});
		});

		promises[page] = deffered;
		return deffered.promise;

	};

	return {
		get: function(page) {
			return getPromise(page);
		}
	}
});

angular.module('PagedFriendsList', ['Friends']).factory('PagedFriendsList', function($http, $q, FriendsList) {
	return {
		get: function(page) {
			var deferred = $q.defer();
			var pagesize = 100;

			FriendsList.query().then(function(data) {
				var result = [];
				for (var i = page * pagesize; i < (page + 1) * pagesize; i++) {
					result.push(data.ids[i]);
				}
				deferred.resolve(result);
			});

			return deferred.promise;
		}
	}
});
angular.module('FriendDetails', ['PagedFriendsList', 'PagedFriendsDetails'])
	.factory('FriendDetails', function(PagedFriendsDetails, $q, PagedFriendsList) {

	return {
		get: function(friendId) {
			var page = Math.floor(friendId / 100);

			return $q.all([PagedFriendsList.get(page), PagedFriendsDetails.get(page)]).then(function(results) {
				var pageOfIds = results[0];
				var pageOfDetails = results[1];

				var index = friendId - (page * 100);
				var id = pageOfIds[index];

				for (var i = 0; i < pageOfDetails.length; i++) {
					if (pageOfDetails[i].id == id) {

						return pageOfDetails[i];

					}
				}
				return {};
			});

		}
	}
});

angular.module('twitlist', ['Friends', 'TwitterList', 'PagedFriendsList', 'PagedFriendsDetails', 'FriendDetails']).config(function($routeProvider) {
	$routeProvider.when('/', {
		controller: HomeCtrl,
		templateUrl: '/view/home.htm'
	}).when('/friend/:friendId', {
		controller: FriendCtlr,
		templateUrl: '/view/friend.htm'
	}).otherwise({
		redirectTo: '/'
	});
});

function HomeCtrl($scope, $location, $routeParams, FriendsList, TwitterList) {
	FriendsList.query().then(function(data) {
		$scope.friendsTotal = data.ids.length;
	});

	TwitterList.query().then(function(data) {
		$scope.lists = data;
	});
}

function FriendCtlr($scope, $routeParams, FriendDetails, TwitterList) {
	var friendId = parseInt($routeParams.friendId);

	$scope.friendId = friendId;
	$scope.prev = friendId - 1;
	$scope.next = friendId + 1;

	FriendDetails.get(friendId).then(function(details) {
		$scope.user = details;
	});

	TwitterList.query().then(function(data) {
		$scope.lists = data;
	});
}