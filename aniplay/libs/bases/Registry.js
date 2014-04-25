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

	var registry = {};

	module.exports = {
		getRegistry : function(){
			return registry;
		},
		registerByType : function(type, instance, family){
			var sup;
			if(typeof registry[type] ==='undefined'){
				registry[type] = {};
			}
			registry[type][instance.id] = instance;
			if(sup = family.constructor.super){
				if(sup._protoOf){
					this.registerByType(sup._protoOf, instance, sup);
				}
			}
		},
		register : function(instance){
			if(instance.id){
				this.registerByType(instance._type, instance, instance);
			}
		},
		getObjectById : function(id, type){
			var result;
			if(type){
				result = registry[type][id];
				if(!result){
					console.log(id+' is not found in the Registry.');
				}
			}else{
				result = registry['BaseObject'][id];
				if(!result){
					console.log(id+'@'+type+' is not found in the Registry.');
				}
			}
			return result;
		}
	};
});