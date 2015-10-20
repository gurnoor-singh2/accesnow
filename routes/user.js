(function () {
    "use strict";

    var config = require(__dirname + '/../common/config');
    var conString = config.db.connectionString;
    var common = require(__dirname + '/../common/common');
    var md5 = require('md5');
    var pg = require('pg');
    var promise = require("q");

    var userHerlper = {};

    //[Exposed method for API]
    userHerlper.login = function (req, res) {
        var userEmailAddress = req.body.emailaddress;
        var userPassword = req.body.password;

        userHerlper._login(userEmailAddress, userPassword)
        .then(function (queryRes) {

            if (queryRes.status !== undefined && queryRes.status == false) {
                res.send(JSON.stringify(queryRes));
            }

            console.log('Logine Success, Now lets create token.');
            var user_id = queryRes.rows[0].id;
            var firstname = queryRes.rows[0].first_name;
            console.log(queryRes);   
            return userHerlper.createToken(user_id, firstname);

        }).then(function (loginResp) {
            res.send(JSON.stringify(loginResp));
        });
    }

    //Private method used for login process //TODO : Need to detach private methods from module.
    userHerlper._login = function (email, password) {
        var deferred = promise.defer();
        pg.connect(conString, function (err, client, done) {
            if (err) {
                console.error('Something went wrong. Error fetching client from pool', err);
                var response = { "status": false, "error": 'Unable to connect to DB' };
                deferred.resolve(response);
            }

            var userEmailAddress = email;
            var userPassword = password;

            client.query('SELECT * FROM users WHERE email_address = $1 AND password = $2 LIMIT 1',
                [userEmailAddress, md5(userPassword)], function (err, queryRes) {

                    console.log('Login done');
                    //call `done()` to release the client back to the pool
                     done();

                    if (queryRes.rowCount == 0) {
                        var response = { "status": false, "error": 'Invalid Credentials' };
                        deferred.resolve(response);
                    }
                    else {
                        deferred.resolve(queryRes);
                    }
                });

        });
        return deferred.promise;
    };

    //Private method used for login process
    userHerlper.createToken = function (userId, fullname) {
        var deferred = promise.defer();
        pg.connect(conString, function (err, client, done) {

            var randomString = common.generateRandomStringForPassword();
            var userTimeStamp = common.getTimeStamp();
            var accessToken = md5(randomString + "_" + userId);
            console.log('token resopnse start');
            var sql = "INSERT into user_tokens(user_id,token,token_time) values ($1,$2,$3)";
            console.log('Creating Token');
            client.query(sql, [userId, accessToken, userTimeStamp], function (err, result) {

                //call `done()` to release the client back to the pool
                done();

                console.log('token resopnse created');

                if (err) {
                    console.log(err);
                    var tokRes = { "status": false, "error": 'Unable to process the request' };
                    deferred.resolve(tokRes);
                }
                else {
                    console.log('Creating Token Success!');
                    var response = { "status": true, 'token': accessToken, fullname: fullname };
                    deferred.resolve(response);
                }
            });

        });
        return deferred.promise;
    };

    //Private method used for login process
    userHerlper.isEmailExist = function (email) {
        var deferred = promise.defer();
        pg.connect(conString, function (err, client, done) {

            client.query("SELECT count(*) as emailrow FROM users WHERE email_address = $1", [email], function (err, response) {
                done();
                console.log('IsEmailExist Success!');

                if (response.rows[0].emailrow == 0) {
                    deferred.resolve({ exist: 0 });
                }
                else {
                    deferred.resolve({ exist: 1 });
                }
            });
        });
        return deferred.promise;
    };

    //[Exposed method for API]
    userHerlper.create = function (req, res) {

        var userEmailAddress = req.body.emailaddress;
        var userFirstName = req.body.firstname;
        var randomString = common.generateRandomStringForPassword();
        var userLastName = req.body.lastname;
        var userPassword = req.body.password;
        var recievenewsletter = req.body.recievenewsletter;
        var privateuser = req.body.privateuser;

        //TODO: Need to write a better logic for it.
        var manValues = [userFirstName, userEmailAddress, userPassword];
        var checkData = common.checkBlank(manValues);
        if (checkData == 1) {
            var response = { "status": false, "error": 'Some parameter missing' };
            res.send(JSON.stringify(response));
        }

        userHerlper.isEmailExist(userEmailAddress)
            .then(function (emailResponse) {
                console.log(JSON.stringify(emailResponse));
                if (emailResponse.exist == 1) {
                    res.send(JSON.stringify({
                        "status": false, "error": 'Email Address(' + userEmailAddress + ') already exist'
                    }));
                }
                else {
                    console.log('Creating user');
                    pg.connect(conString, function (err, client, done) {
                        if (err) {
                            console.error('Something went wrong. Error fetching client from pool', err);
                            var response = { "status": false, "error": 'Unable to connect to DB' };
                            res.send(JSON.stringify(response));
                        }
                        var sql = "INSERT into users(first_name,last_name,email_address,password,added_on,recievenewsletter,privateuser)" +
                            " values ($1,$2,$3,$4,$5,$6,$7)";
                        console.log(sql);
                        client.query(sql,
                                [userFirstName,
                                userLastName,
                                userEmailAddress,
                                md5(userPassword),
                                common.getCurrentDate(),
                                recievenewsletter,
                                privateuser],
                                function (err, result) {
                                    if (err) {
                                        console.log(err);
                                        var userResponse = { "status": false, "error": 'Unable to process the request' };
                                        res.send(JSON.stringify(userResponse));
                                    }
                                    else {
                                        console.log('Logging in');
                                        //We inserted the user. let's create an auth token.
                                        userHerlper._login(userEmailAddress, userPassword)
                                        .then(function (loginResponse) {

                                            if (loginResponse.status !== undefined && loginResponse.status == false) {
                                                res.send(JSON.stringify(loginResponse));
                                            }

                                            var user_id = loginResponse.rows[0].id;
                                            var firstname = loginResponse.rows[0].first_name;
                                            console.log('Calling create token with userid : ' + user_id + ' Firstname : ' + firstname);
                                            return userHerlper.createToken(user_id, firstname);

                                        }).then(function (resp) {
                                            res.send(JSON.stringify(resp));
                                        });
                                    }
                                });
                    });
                }
            });
    };

    //Private method used for login process
    userHerlper.deleteToken = function (token) {

        var deferred = promise.defer();

        pg.connect(conString, function (err, client, done) {

            if (err) {
                console.error('Something went wrong. Error fetching client from pool', err);
                var response = { "status": false, "error": 'Unable to connect to DB' };
                res.send(JSON.stringify(response));
            }

            var sql = "DELETE FROM user_tokens WHERE token = $1";
            client.query(sql, [token], function (err, result) {

                done();

                if (err) {
                    console.log(err);
                    var response = { "status": false, "error": 'Unable to process the request' };
                    deferred.resolve(response);
                }
                else {
                    var response = { "status": true };
                    deferred.resolve(response);
                }
            });

        });

        return deferred.promise;
    };

    //Private method used for login process
    userHerlper._getToken = function (token) {

        var deferred = promise.defer();

        pg.connect(conString, function (err, client, done) {

            if (err) {
                console.error('Something went wrong. Error fetching client from pool', err);
                var response = { "status": false, "error": 'Unable to connect to DB' };
                deferred.resolve(response);
            }

            var sql = "SELECT * FROM user_tokens WHERE token = $1";
            client.query(sql, [token], function (err, response) {

                done();

                if (response.rowCount == 0) {
                    var response = { "status": false, "error": 'Invalid Token' };
                    deferred.resolve(response);
                }
                else {
                    var response = { "status": true, "user_id":response.rows[0].user_id };
                    deferred.resolve(response);
                }
            });
        });

        return deferred.promise;
    };
    
    //Private method used for login process
    userHerlper._validateSuperUserToken = function (token) {
        var deferred = promise.defer();
        pg.connect(conString, function (err, client, done) {
            if (err) {
                console.error('Something went wrong. Error fetching client from pool', err);
                var response = { "status": false, "error": 'Unable to connect to DB' };
                deferred.resolve(response);
            }
            var sql = "SELECT t.user_id,u.is_super_user FROM user_tokens t INNER JOIN users u ON t.user_id = u.id WHERE t.token = $1";
            client.query(sql, [token], function (err, response) {
                done();
                if (response.rowCount == 0) {
                    var response = { "status": false, "error": 'Invalid Token' };
                    deferred.resolve(response);
                }
                else {
                    if(response.rows[0].is_super_user){
                        var response = { "status": true, "user_id":response.rows[0].user_id };            
                    }
                    else{
                        var response = { "status": false, "error": 'Unauthorized Access' };
                    }                    
                    deferred.resolve(response);
                }
            });
        });
        return deferred.promise;
    };


    //[Exposed method for API]
    userHerlper.logout = function (req, res) {
        var token = req.body.token;
        var manValues = [token];
        var checkData = common.checkBlank(manValues);
        if (checkData == 1) {
            var response = { "status": false, "error": 'Token is missing' };
            res.send(JSON.stringify(response));
        }
        else {

            userHerlper._getToken(token)
            .then(function (getTokenResponse) {
                if (getTokenResponse.status) {
                    return userHerlper.deleteToken(token);
                }
                else {
                    var response = { "status": false, "error": 'Invalid token' };
                    res.send(JSON.stringify(response));
                }
            })
            .then(function (deleteTokenResponse) {
                res.send(JSON.stringify(deleteTokenResponse));
            });
        }
    };

    //[Exposed method for API]
    userHerlper.getAll = function (req, res) {
        pg.connect(conString, function (err, client, done) {

            if (err) {
                console.error('Something went wrong. Error fetching client from pool', err);
                var response = { "status": false, "error": 'Unable to connect to DB' };
                res.send(JSON.stringify(response));
            }

            var results = [];

            var query = client.query("SELECT * FROM users order by id");
            query.on('row', function (row) {
                results.push(row);
            });

            query.on('end', function () {
                return res.json(results);
            });
        });
    };
    
    userHerlper.userInfo = function (req, res) {
		var token = req.body.token;			
		var checkData = common.checkBlank([token]);		
		if(checkData == 1){ 										
			res.send(JSON.stringify( { "status": false, "error": 'Some parameter missing','status_code':config.statusCodes.fieldRequired } ));
		}
		else{
			userHerlper._getToken(token).then(function (tokenResponse) {
				if(tokenResponse.status){
					 pg.connect(conString, function (err, client, done) {
						if (err){
							res.send(JSON.stringify( { "status": false, "error": 'Unable to connect to DB' , 'status_code':config.statusCodes.db.ConnectionError } ));
						}
						else{
							var sql = "SELECT * FROM users WHERE id = $1";
							 client.query(sql, [tokenResponse.user_id], function (err, response) {
								done();
								if (response.rowCount == 0) {									
									res.send(JSON.stringify( { "status": false, "error":'Invalid User','status_code':config.statusCodes.invalidRequest} ));									
								}
								else {								
									var results = [];																	
									res.send(JSON.stringify( { 
											"status": true, 
											'status_code':config.statusCodes.success,
											'first_name':response.rows[0].first_name,
											'last_name':response.rows[0].last_name,
											'email_address':response.rows[0].email_address,
											} 
									));		
												
								}
							});
						}
					 });
				}
				else{
					res.send(JSON.stringify( { "status": false, "error": tokenResponse.error,'status_code':config.statusCodes.invalidRequest } ));
				}
			});
		}
	};

    module.exports = userHerlper;

})();
