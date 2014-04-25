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

	//Empty init
	var initEmpty = function(){};

	//Proxy Constructor (for once)
	var Proxy = function(x){
		util.defineProperty(this,'_protoOf',{value:x});
	};

	var util = {

		is : function(o, type){
			return ({}).toString.call(o) === '[object '+type+']';
		},

		defineProperty : function(obj, prop, descriptor){
			if(typeof Object.defineProperty==='function'){
				Object.defineProperty(obj, prop, descriptor);
			}else{
				obj[prop] = descriptor.value;
			}
		},

		copyOwnProperties : function(src, target){
			if(src instanceof Object){
				var k;
				for(k in src){
					if(src.hasOwnProperty(k)){
						target[k] = src[k];
					}
				}
			}
		},

		/**
		 * Define Class
		 *
		 * @method defineClass
		 * @param {Object} p
		 * @returns {Function} Constructor
		 */
		Class : function(p) {

			var dynamics = p.dynamics || {},
				statics = p.statics || {};
				dynamics.init = p.init || initEmpty;

			//Constructor
			var Clazz = function(){
				util.defineProperty(this,'_type',{value:p.name||''});
				if(Clazz.prototype.hasOwnProperty('init')){
					Clazz.prototype.init.apply(this, arguments);
				}
			};

			//Extend Dynamics
			var Extend = p.extend || Object;
			Proxy.prototype = Extend.prototype;
			Clazz.prototype = new Proxy(p.name);
			this.defineProperty(Clazz.prototype,'constructor',{value:Clazz});

			//Extend Statics
			this.copyOwnProperties(Extend, Clazz);

			// overwrite Extend.super
			this.defineProperty(Clazz,'super',{value:Extend.prototype});

			//Add Dynamics
			this.copyOwnProperties(dynamics, Clazz.prototype);

			//Add Statics (if exist override)
			this.copyOwnProperties(statics, Clazz);

			return Clazz;
		},

		/**
		 * Define Interface
		 *
		 * @param {Object} p 
		 * @returns {Function} Constructor Function
		 */
		Interface : function(p) {
			//TODO
		}
	};

	module.exports = util;
});
