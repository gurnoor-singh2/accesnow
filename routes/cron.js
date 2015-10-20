(function () {
    "use strict";

    var config = require(__dirname + '/../common/config');
    var common = require(__dirname + '/../common/common');
    var pg = require('pg');
    var promise = require("q");
	var xmlrpc = require('xmlrpc');
	
    var userHerlper = require(__dirname + '/../routes/user');   
    var domainHerlper = require(__dirname + '/../routes/domain');
    var userTimeStamp = common.getTimeStamp();
    var cronHerlper   = {};
          
    var gandiApi = xmlrpc.createSecureClient({
							host: config.gandi.host,
							port: config.gandi.port,
							path: '/xmlrpc/'
					});

    
	cronHerlper.queueProcess = function (req, res) {		
		cronHerlper._domainProcessing().then(function(cres){ 
			if(cres.status){
				res.send(JSON.stringify( { "status": true } ));
			}
		});
		
	};
	
	//[Exposed method to check nameserver]
	cronHerlper._domainProcessing = function () {
		var deferred = promise.defer();
		pg.connect(config.db.connectionString, function (err, client, done) {
			var sql = "SELECT q.*,d.domain_name FROM user_domain_queue q INNER JOIN user_domain_order d ON d.id = q.domain_order_id WHERE q.status IN ('WAIT','RUN','BILL') order by q.id desc";
			client.query(sql,function(err,result){
				done();                
                if (!err) {
					for(var i = 0; i < result.rows.length; i++){
						var row = result.rows[i];			
						cronHerlper._operationInfo(row,i).then(function(cres){

							console.log("Action: "+cres.row.action+", Operation ID: "+cres.row.operation_id+", Status: "+cres.step);							
							if(cres.status){
								var sql = "UPDATE user_domain_queue SET status = $1,updated_on=$2 WHERE operation_id = $3";
								client.query(sql,[cres.step,userTimeStamp,cres.row.operation_id],function(err,result){ });		
								if(cres.row.action == "Nameserver"){
									//update nameservers if api done
									if(cres.step == "DONE"){	 			
										var sql = "UPDATE user_domain_order SET nameservers = $1,updated_on=$2 WHERE domain_name = $3";
										client.query(sql,[cres.domaininfo.nameservers,userTimeStamp,cres.row.domain_name],function(err,result){ });
									}				
								}

								if(cres.row.action == "Register" || cres.row.action == "Renew"){
									// update the domain information
									if(cres.step == "DONE"){	 	
										var sql = "UPDATE user_domain_order SET autorenew = $1,nameservers = $2,date_registry_end = $3,date_hold_begin = $4,date_hold_end = $5,date_restore_end=$6,status=$7,updated_on=$8,duration=$9 WHERE domain_name = $10";
										client.query(sql,[
															cres.domaininfo.autorenew,
															cres.domaininfo.nameservers,
															cres.domaininfo.date_registry_end,
															cres.domaininfo.date_hold_begin,
															cres.domaininfo.date_hold_end,
															cres.domaininfo.date_restore_end,
															cres.step,
															userTimeStamp,
															cres.duration,
															cres.row.domain_name
														],
											function(err,result){ 
											});
									}									
								}								
							}											
							if(cres.operationCount == result.rows.length-1){
								deferred.resolve( {status: true} );
							}							
						});					 
					}
					if(result.rows.length == 0){
						deferred.resolve( {status: true} );
					}
				}
			});
		});
		return deferred.promise;
	};
		
	
	cronHerlper._operationInfo = function (row,operationCount) {
		var deferred = promise.defer();
		gandiApi.methodCall( 'operation.info', [config.gandi.key, row.operation_id],function(error, value) {			
			if(error){
				deferred.resolve( {status: false,operationCount:operationCount,row:row} );	
			}
			else{
				var duration = value.params.duration;
				if(value.step == "DONE"){
					gandiApi.methodCall( 'domain.info', [config.gandi.key, row.domain_name],function(error, value) {
						if(!error){
							deferred.resolve( {status: true,operationCount:operationCount, step:"DONE",domaininfo:value,row:row,duration:duration} );
						}
						else{
							deferred.resolve( {status: false,operationCount:operationCount, step:"DONE",row:row,duration:duration} );
						}
					});					
				}
				else{
					deferred.resolve( {status: true,operationCount:operationCount, step:value.step,row:row,duration:duration} );
				}
			}
		});
		return deferred.promise;
	};
	
	
    module.exports = cronHerlper;

})();
