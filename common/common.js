/*
 * ------------------------------------------------------
 *  Get Last User ID
 *  OUTPUT : last_id
 * ------------------------------------------------------
 */

exports.getLastID = function(connection,callback){   
    connection.query("SELECT max(id) as last_id FROM users").on('row', function(row) {						
		return callback(row.last_id+1);
	}); 
};

/*
 * ------------------------------------------------------
 *  Get Email Address
 *  OUTPUT : true/false
 * ------------------------------------------------------
 */

exports.checkEmailExist = function(connection,userEmailAddress,callback){   
    connection.query("SELECT count(*) as emailrow FROM users WHERE email_address = $1",[userEmailAddress]).on('row', function(row) {						
		return callback(row.emailrow);
	}); 
};

exports.checkUserLogin = function(connection,userEmailAddress,userPassword,callback){   
    connection.query("SELECT * FROM users WHERE email_address = $1 AND password = $2",[userEmailAddress,userPassword]).on('row', function(row) {						
		return callback(row);
	}); 
};

/*
 * ------------------------------------------------------
 * Check if manadatory fields are not filled
 * INPUT : array of field names which need to be mandatory
 * OUTPUT : Error if mandatory fields not filled
 * ------------------------------------------------------
*/

exports.checkBlank = function(arr){
    var arrlength = arr.length;
    for (var i = 0; i < arrlength; i++){
        if (arr[i] == '' || typeof arr[i] == 'undefined'){
            return 1;
            break;
        }
    }
    return 0;
};

/*
 * -----------------------------------------------------------------------------
 * sorting an array in ascending order
 * INPUT : array and key according to which sorting is to be done
 * OUTPUT : sorted array
 * -----------------------------------------------------------------------------
 */
exports.sortByKeyAsc = function(array, key) {
    return array.sort(function(a, b) {
        var x = a[key];
        var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
};

/*
 * -----------------------------------------------------------------------------
 * sorting an array in descending order
 * INPUT : array and key according to which sorting is to be done
 * OUTPUT : sorted array
 * -----------------------------------------------------------------------------
 */
exports.sortByKeyDesc = function(array, key) {
    return array.sort(function(a, b) {
        var x = a[key];
        var y = b[key];
        return ((x > y) ? -1 : ((x < y) ? 1 : 0));
    });
};

/*
 * ----------------------------------------------------------------------------------------------------------------------------------------
 * Generating a random string
 * INPUT :
 * OUTPUT : string generated
 * ----------------------------------------------------------------------------------------------------------------------------------------
 */
exports.generateRandomString = function(){
    var math = require('mathjs');    
    var text = "";
    var possible = "123456789";

    for (var i = 0; i < 4; i++)
        text += possible.charAt(math.floor(math.random() * possible.length));

    return text;
};

exports.generateRandomStringForPassword = function(){
    var math = require('mathjs');    
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    
    for (var i = 0; i < 6; i++)
        text += possible.charAt(math.floor(math.random() * possible.length));

    return text;
};

exports.getDateTime = function() {
    var date = new Date();
    
    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    
    var min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + "-" + month + "-" + day + " " + hour + ":" + min + ":" + sec;
    
};

exports.getCurrentDate = function() {
	
	var date = new Date();
	
	var year = date.getFullYear();
	
	var month = ("0" + (date.getMonth()+1)).slice(-2);
	
	var day  = ("0" + date.getDate()).slice(-2);		
	
	return year+"-"+month+"-"+day;
	
};

exports.getTimeStamp = function(){
	return new Date().getTime();	
} 

exports.getGandiErrTxt = function (error){	
	var errStr = "";
	var errParths = error.match(/\[(.*?)\]/);
	if(errParths != ""){
		errStr =  errParths[1];
	}
	var cSymbolPos = errStr.indexOf("'^");
	if(cSymbolPos > 0){
		errStr = errStr.substring(0, cSymbolPos);
	}
	return errStr;
}
