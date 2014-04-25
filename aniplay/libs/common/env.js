/****************************************************************************
 Copyright (c) 2014 Peter, H

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

"use strict";
define(function(require, exports, module) {

	var css = require('common/css');

	module.exports = {
		agent : null,
		useJQuery : false,
		init : function(p){
			console.log('env.init()');
			this.detectAgent();
			this.setJQuery(p.useJQuery);
		},
		setJQuery : function(useJQuery){
			if(typeof jQuery !='undefined' && useJQuery){
				this.useJQuery = true;
			}
		},
		detectAgent : function(){
			console.log('env.detectAgent()');
			var userAgent = window.navigator.userAgent;
			console.log('userAgent = '+userAgent);
			if((/ Qt/ig).test(userAgent)){
				this.agent = 'qt';
			}else if((/ OPR/ig).test(userAgent)){
				this.agent = 'opera';
			}else if((/ Chrome/ig).test(userAgent)){
				this.agent = 'chrome';
			}else if((/ Safari/ig).test(userAgent)){
				this.agent = 'safari';
			}else if((/ Firefox/ig).test(userAgent)){
				this.agent = 'firefox';
			}else if((/ MSIE/ig).test(userAgent)){
				this.agent = 'ie';
			}
			console.log('env.agent = '+this.agent);
		}
	};
});
