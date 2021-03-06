(function() {
    // Config
    var timelinePageCount = 3;

    // Templating functions
    var setUsers = function(users) {
            console.info('called setUsers with these users:', users);
            $('#user-select').html(_.template($('#user-select-template').html())({
                users: users
            })).find('select').on('change', handleUserChange).val(Object.keys(users)[0]).trigger('change');

        },
        setTimeline = function(timeline, userKey, buttons, callback) {
            console.info('called setTimeline with this timeline:', timeline);
            $('#user-timeline').html(_.template($('#user-timeline-template').html())({
                timeline: timeline,
                userKey: userKey,
                loadMore: buttons ? buttons.loadMore || false : false,
                orderByText: buttons ? buttons.orderByText || false : false,
                reset: buttons ? buttons.reset || false : false
            }));

            if (typeof callback === 'function') {
                callback();
            }
        },
        setFollowing = function(following) {
            console.info('called setFollowing with this following:', following);
            $('#user-following').html(_.template($('#user-following-template').html())({
                following: following
            }));

        },
        setTweetBox = function(user) {
            console.info('called setTweetBox with this user:', user);
            $('#user-tweet-box').html(_.template($('#user-tweet-box-template').html())({
                user: user
            })).find('textarea').on('keyup', function(e) {
                var characterCount = $(e.target).val().length,
                    tweetLength = $('#tweet-length'),
                    tweetButton = $('#tweet-button');

                tweetLength.text(140 - characterCount);

                if (characterCount <= 140) {
                    tweetLength.css('color', 'gray');

                    if (characterCount > 0) {
                        tweetButton.removeAttr('disabled');
                    }
                } else {
                    tweetLength.css('color', 'red');
                    tweetButton.attr('disabled', 'disabled');
                }
            });
        };

    /*
     * Configure your firebase
     * - Edit the firebaseRoot variable to reference your firebase 
     */
    var firebaseRoot = "https://demos-firebase.firebaseio.com/twitterClone/",
        usersRef = new Firebase(firebaseRoot + 'users'),
        userObjectsRef = new Firebase(firebaseRoot + 'userObjects');

    /*
     * Query user data
     * - Create a ref to /twitterClone/users and listen to the that ref's "value" event using the .once function
     * - Call the setUsers function with the resulting data
     */
    usersRef.once('value', function(snap) {
        setUsers(snap.val());
    });

    var timelineRef,
        timelineHandler,
        userRef,
        userHandler,
        tweetsRef,
        tweetAddedHandler,
        tweetRemovedHandler,
        tweetBoxClickHandler,
        stopListeningToTimeline = function() {
            if (typeof timelineRef === 'object' && typeof timelineHandler) {
                timelineRef.off("value", timelineHandler);
            }
        },
        stopListening = function() {
            stopListeningToTimeline();

            if (typeof userRef === 'object' && typeof userHandler) {
                userRef.off("value", userHandler);
            }

            if (typeof tweetsRef === 'object' && typeof tweetAddedHandler) {
                tweetsRef.off("child_added", tweetAddedHandler);
            }

            if (typeof tweetsRef === 'object' && typeof tweetRemovedHandler) {
                tweetsRef.off("child_removed", tweetRemovedHandler);
            }

        },
        flatten = function(tweets) {
            var keys = Object.keys(tweets),
                i = keys.length,
                result = [],
                tweet;
            while (i--) {
                tweet = tweets[keys[i]];
                tweet.key = keys[i];
                result.unshift(tweet);
            }
            return result;
        };

    var handleUserChange = function(e) {
        var userKey = $(e.target).val();

        stopListening();

        if (userKey) {
            /*
             * Query timeline data
             * - Create a ref to /twitterClone/userObjects/timeline/***userKey*** and set to the timelineRef variable
             * - Listen to timelineRef's "value" event using the .on function to listen to all future events and save the result of the .on function as timelineHandler
             * - Call the setTimeline function with the data resulting from each "value" event and userKey as a second argument
             */
            var lastKey = false,
                page = 0,
                setQueryHandlers = function() {
                    $('#load-more').on('click', queryTimeline)
                    $('#reset').on('click', resetTimeline);
                    $('#order-by-text').on('click', orderByText);
                },
                resetTimeline = function() {
                    lastKey = false;
                    page = 0;
                    queryTimeline();
                },
                orderByText = function(text) {
                    var timeline = [];
                    stopListeningToTimeline();
                    timelineRef = userObjectsRef.child('timeline').child(userKey).orderByChild('text');
                    timelineHandler = timelineRef.on('child_added', function(snap) {
                        timeline.push(snap.val());
                        setTimeline(timeline, userKey, {
                            reset: true
                        }, setQueryHandlers);
                    });
                },
                queryTimeline = function() {
                    stopListeningToTimeline();
                    page += 1;

                    var showLimit = timelinePageCount * page,
                        queryLimit = showLimit + 1,
                        reset = false;

                    timelineRef = userObjectsRef.child('timeline').child(userKey).orderByKey().limitToLast(queryLimit);

                    timelineHandler = timelineRef.on('value', function(snap) {
                        var loadMore = false,
                            tweets = flatten(snap.val());

                        if (tweets.length >= queryLimit) {
                            loadMore = true;
                            tweets.shift();
                        }

                        if (tweets.length > timelinePageCount) {
                            reset = true;
                        }

                        setTimeline(tweets.reverse(), userKey, {
                            loadMore: loadMore,
                            reset: reset,
                            orderByText: true
                        }, setQueryHandlers);
                    });
                };



            queryTimeline();



            /*
             * Query following data
             * - Create a ref to /twitterClone/userObjects/following/***userKey*** and listen to the ref's "value" event using the .once function
             * - Call the setFollows function with the resulting data
             */
            userObjectsRef.child('following').child(userKey).once('value', function(snap) {
                setFollowing(snap.val());
            });

            /*
             * Query user profile
             * - Create a ref to /twitterClone/users/***userKey*** and listen to the ref's "value" event using the .once function
             * - Call the setTweetBox function with the resulting data
             */
            userRef = usersRef.child(userKey);

            userHandler = userRef.on('value', function(snap) {
                setTweetBox(snap.val());
            });

            var userTweetBox = $('#user-tweet-box');

            if (typeof tweetBoxClickHandler === 'function') {
                userTweetBox.off('click', 'button', tweetBoxClickHandler);
            }

            tweetBoxClickHandler = function(e) {
                e.preventDefault();

                var tweet = {
                    text: userTweetBox.find('textarea').val(),
                    created: (new Date()).toString()
                };

                userTweetBox.find('textarea').val('').focus();

                /*
                 * 6. Create new tweet
                 * - Create a ref to /twitterClone/userObjects/tweets/***userKey***
                 * - Push the new tweet to this ref.
                 * - Nothing will happen at this point... so go to step 7 to listen for the change.
                 */
                userObjectsRef.child('tweets').child(userKey).push(tweet, function(err) {
                    if (err) {
                        console.warn('error!', err);
                    } else {
                        usersRef.child(userKey).child('tweetCount').transaction(function(i) {
                            return (i || 0) + 1;
                        });
                    }
                });
            };

            userTweetBox.on('click', 'button', tweetBoxClickHandler);

            /*
             * Fan out new tweets
             * - Create a ref to /twitterClone/userObjects/tweets/***userKey*** and assign to tweetsRef variable
             * - Listen to tweetsRef's "child_added" event using the .on function and save the result to the tweetAddedHandler variable
             * - Save snap.val() and snap.ref() to variables... preferrably "tweet" and "tweetRef"
             * - "child_added" is fired for every tweet in existence, not just new children, so check to see if the tweet's "fannedOut" attribute is true
             * - If the tweet has not been fanned out, create a reference to /twitterClone/users/***userKey*** and listen to it's "value" event to capture the current user object
             * - Once you have the user object, create a reference to /twitterClone/userObjects/followers/###userKey###/list and listen to it's "value" event using .once
             * - The resulting dataSnapshot will contain a list of all users that are following the current user. Save snap.numChildren() a counter variable and use snap.forEach to loop through all followers
             * - Add a user attribute to the original tweet. The user will need to inherit the tweeting user's email, key, name and username attributes
             * - Add a tweetKey attribute to the original tweet. This can be accessed using tweetRef.key()
             * - Create a ref to /twitterClone/userObjects/timeline/***follower.key*** and push the new tweet to it
             * - Create a callback function for the .push function and decrement the numChildren counter variable first thing
             * - If the decremented numChildren counter is zero, use the .set() function to set the tweetRef's "fannedOut" attribute to true
             */
            tweetsRef = userObjectsRef.child('tweets').child(userKey);

            tweetAddedHandler = tweetsRef.on('child_added', function(snap) {
                console.log('child_added fired with ', userKey);
                var tweet = snap.val(),
                    tweetRef = snap.ref();

                if (!tweet.fannedOut) {
                    usersRef.child(userKey).once('value', function(snap) {
                        var user = snap.val(),
                            tweetUser = {
                                email: user.email,
                                key: snap.key(),
                                name: user.name,
                                username: user.username,
                            };

                        userObjectsRef.child('followers').child(userKey).child('list').once('value', function(snap) {
                            var i = snap.numChildren();
                            snap.forEach(function(childSnap) {
                                var follower = childSnap.val();

                                tweet.tweetKey = tweetRef.key();

                                tweet.user = tweetUser;

                                userObjectsRef.child('timeline').child(follower.key).push(tweet, function(err) {
                                    i -= 1;
                                    if (!i) {
                                        tweetRef.child('fannedOut').set(true);
                                    }
                                });
                            });
                        });

                    });

                }
            });

            /*
             * Fan out tweet deletions
             * - You assigned a ref to the tweetsRef variable in step 8. Now listen to tweetsRef's "child_removed" event using the .on function and save the result to the tweetRemovedHandler variable
             * - Save the tweet's key for future use
             * - Create a reference to /twitterClone/userObjects/followers/###userKey###/list and use .once to capture its value
             * - User snap.forEach() to loop through the user's followers
             * - Save the follower object using childSnap.val(). You'll need the follower's key for the next step
             * - For each follower, find the tweet to delete by creating a ref to /twitterClone/timeline/###follower.key###/
             * - Use the .orderByChild and .equalTo query functions to limit the results to timeline items with a matching tweetKey. Listen to the result's value with .once
             * - Loop through the resulting snap using .forEach(). There should only be one result... but just to be safe
             * - Call childSnap.ref().remove() on each childSnap
             */
            tweetRemovedHandler = tweetsRef.on('child_removed', function(snap) {
                var tweetKey = snap.key();

                userObjectsRef.child('followers').child(userKey).child('list').once('value', function(snap) {
                    snap.forEach(function(childSnap) {
                        var follower = childSnap.val();
                        console.log('remove from follower', follower);
                        userObjectsRef.child('timeline').child(follower.key).orderByChild('tweetKey').equalTo(tweetKey).once('value', function(snap) {
                            snap.forEach(function(childSnap) {
                                childSnap.ref().remove();
                            });
                        });
                    });
                });
            });



        } else {
            setTweetBox({});
            setTimeline({});
            setFollowing({});
        }

        $('#user-timeline').on('click', 'button.remove-tweet', function(e) {
            var target = $(e.target),
                userKey = target.attr('user-key'),
                tweetKey = target.attr('tweet-key');

            console.log("Deleting with this userKey and tweetKey", userKey, tweetKey);

            /*
             * Remove tweet
             * - Create a ref to /twitterClone/userObjects/tweets/###userKey###/###tweetKey###
             * - Call .remove() on that ref
             * - If the remove is successful, use .transaction() to decrement /twitterClone/users/###userKey###/tweetCount
             */
            userObjectsRef.child('tweets').child(userKey).child(tweetKey).remove(function(err) {
                if (err) {
                    console.warn('Tweet deletion error', err);
                } else {
                    usersRef.child(userKey).child('tweetCount').transaction(function(i) {
                        return Math.max(0, (i || 0) - 1);
                    });
                }
            });

        });

    };

})();